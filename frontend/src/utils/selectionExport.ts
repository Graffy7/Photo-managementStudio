// Exports a gallery's selected ORIGINAL photos into a folder the owner chooses on their computer:
//   <chosen folder>\<Event>_Selected\<Category>\Normal\...   and   ...\<Category>\Big Size\...
// The server lists what to export (selectionExportManifest); each original comes either from the
// server (photos imported from the studio's photo folder) or from the studio's own computer (photos
// added through the browser - the server never had those originals).
//
// Rules: an existing file is never overwritten; files are written through the browser's own
// write-then-commit, so a half-written file never appears under the real name; every written file is
// read back and its size compared before it counts as copied.

import { apiClient } from "../api/client";
import type { SelectionExportFile, SelectionExportManifest } from "../types/photoSelection";
import { openPhotoFolders, type DirHandle } from "./devicePhotos";

export interface ExportFailure {
  path: string; // Category/Size/FileName, as it would appear in the export
  reason: string;
}

export interface ExportProgress {
  total: number;
  processed: number;
  copied: number;
  alreadyThere: number;
  failed: number;
  failures: ExportFailure[];
}

export type FolderChoice =
  | { ok: true; handle: DirHandle }
  | { ok: false; reason: "cancelled" | "denied" | "unsupported" | "error"; message: string };

export function folderExportSupported(): boolean {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) return false;
  // Browsers inside other apps (Electron-based) expose the function but it cancels at once.
  return !/Electron|Claude\//.test(navigator.userAgent);
}

// Asks for a destination folder with read/write access. Must be called straight from a click.
export async function chooseDestinationFolder(): Promise<FolderChoice> {
  if (!folderExportSupported()) {
    return { ok: false, reason: "unsupported", message: "This browser can't save into a folder. Use Chrome or Edge on a computer, or download a ZIP instead." };
  }
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  let handle: DirHandle;
  try {
    handle = await picker({ id: "selection-export", mode: "readwrite", startIn: "pictures" });
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "AbortError") return { ok: false, reason: "cancelled", message: "No folder chosen." };
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { ok: false, reason: "denied", message: "The browser didn't allow access to that folder. Choose a normal folder (not a system folder like Windows or Program Files) and click Allow." };
    }
    return { ok: false, reason: "error", message: "The folder window couldn't be opened. Please try again." };
  }
  // The picker asked for read/write; make sure it was actually granted.
  const state = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (state !== "granted") {
    const asked = await handle.requestPermission?.({ mode: "readwrite" }).catch(() => "denied" as PermissionState);
    if (asked !== "granted") return { ok: false, reason: "denied", message: "Saving into that folder wasn't allowed. Click Allow when the browser asks." };
  }
  return { ok: true, handle };
}

const keyOf = (f: SelectionExportFile) => `${f.category}/${f.sizeFolder}/${f.fileName}`;

// Reads the original of one photo stored on the server (the browser sends only the photo id).
async function downloadOriginal(galleryId: number, photoId: number): Promise<Blob> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await apiClient.get<Blob>(`/api/photo-galleries/${galleryId}/selection-export/photos/${photoId}`, { responseType: "blob" });
      return res.data;
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: unknown } }).response?.status;
      // Busy server / too many requests / dropped connection: wait and try again (twice).
      if ((status === undefined || status === 429 || status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(await serverReason(err));
    }
  }
}

async function serverReason(err: unknown): Promise<string> {
  const data = (err as { response?: { data?: unknown } }).response?.data;
  try {
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text()) as { message?: string };
      if (parsed.message) return parsed.message;
    }
  } catch {
    // not JSON
  }
  return (err as { response?: unknown }).response ? "the server couldn't provide this original" : "the connection was lost while downloading it";
}

async function readComputerOriginal(folders: Map<string, DirHandle>, f: SelectionExportFile): Promise<File> {
  const root = folders.get((f.computerFolder ?? "").toLowerCase());
  if (!root) throw new Error("the photo folder on this computer wasn't opened");
  // Normally the photo folder itself; if the owner chose the folder above it, look inside.
  const base = (f.computerFolder ?? "").toLowerCase() === root.name.toLowerCase()
    ? root
    : await root.getDirectoryHandle(f.computerFolder!).catch(() => root);
  const parts = (f.computerRelativePath ?? "").split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((p) => p === ".." || p === ".")) throw new Error("its recorded location isn't valid");
  let dir = base;
  try {
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    return await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
  } catch {
    throw new Error("the original wasn't found in the photo folder (moved, renamed or deleted?)");
  }
}

// Opens the photo folders on this computer that the computer-stored originals live in. Asks only
// for folders this browser doesn't already have access to. Must be called straight from a click.
export async function openComputerSources(galleryId: number, manifest: SelectionExportManifest) {
  const sources = [...new Set(manifest.files.filter((f) => f.location === "Computer").map((f) => f.computerFolder!).filter(Boolean))];
  if (sources.length === 0) return new Map<string, DirHandle>();
  return (await openPhotoFolders(galleryId, sources)).folders;
}

async function existingFile(dir: DirHandle, name: string): Promise<File | null> {
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

function describeWriteError(err: unknown): string {
  const name = (err as { name?: string }).name;
  if (name === "QuotaExceededError") return "the disk is full";
  if (name === "NotAllowedError" || name === "SecurityError") return "the browser no longer has permission to write to that folder";
  if (name === "NoModificationAllowedError" || name === "InvalidModificationError") return "the file is locked or open in another program";
  if (name === "NotFoundError") return "the destination folder was moved or deleted during the export";
  return (err as Error)?.message || "it couldn't be written";
}

// Runs the export. Three files at a time; progress is reported after every file.
export async function exportSelection(
  galleryId: number,
  manifest: SelectionExportManifest,
  destination: DirHandle,
  computerFolders: Map<string, DirHandle>,
  onProgress: (p: ExportProgress) => void,
  signal?: { cancelled: boolean },
): Promise<ExportProgress> {
  const progress: ExportProgress = { total: manifest.files.length, processed: 0, copied: 0, alreadyThere: 0, failed: 0, failures: [] };
  const fail = (f: SelectionExportFile, reason: string) => {
    progress.failed++;
    progress.failures.push({ path: keyOf(f), reason });
  };
  onProgress({ ...progress });

  const root = await destination.getDirectoryHandle(manifest.rootFolderName, { create: true });
  // Every category with selected photos gets both Normal and Big Size (even if one stays empty).
  // Folders are created once each, before any copying, so parallel workers never race on them.
  const dirs = new Map<string, DirHandle>();
  for (const name of manifest.categories) {
    const category = await root.getDirectoryHandle(name, { create: true });
    for (const size of ["Normal", "Big Size"]) dirs.set(`${name}/${size}`, await category.getDirectoryHandle(size, { create: true }));
  }

  let next = 0;
  const worker = async () => {
    while (next < manifest.files.length && !signal?.cancelled) {
      const f = manifest.files[next++];
      const dir = dirs.get(`${f.category}/${f.sizeFolder}`)!;
      try {
        // Exported before (same name, same size as the original): left alone without re-reading it.
        const before = await existingFile(dir, f.fileName);
        if (before && f.fileSize !== null && before.size === f.fileSize) {
          progress.alreadyThere++;
          progress.processed++;
          onProgress({ ...progress, failures: [...progress.failures] });
          continue;
        }
        const original = f.location === "Computer"
          ? await readComputerOriginal(computerFolders, f)
          : await downloadOriginal(galleryId, f.photoId);

        const existing = await existingFile(dir, f.fileName);
        if (existing) {
          // Same name already there: identical size = already exported (left alone); otherwise a
          // different file is in the way - it is never overwritten.
          if (existing.size === original.size) progress.alreadyThere++;
          else fail(f, "a different file with this name is already in the destination folder (it was not overwritten)");
        } else {
          const handle = await dir.getFileHandle(f.fileName, { create: true });
          const writer = await handle.createWritable();
          try {
            await writer.write(original);
            await writer.close(); // the file appears under its name only now, complete
          } catch (err) {
            await (writer as { abort?: () => Promise<void> }).abort?.().catch(() => undefined);
            await dir.removeEntry?.(f.fileName).catch(() => undefined);
            throw err;
          }
          const written = await handle.getFile();
          if (written.size !== original.size) {
            await dir.removeEntry?.(f.fileName).catch(() => undefined);
            throw new Error(`the copy is incomplete (${written.size} of ${original.size} bytes); it was removed`);
          }
          progress.copied++;
        }
      } catch (err) {
        fail(f, describeWriteError(err));
      }
      progress.processed++;
      onProgress({ ...progress, failures: [...progress.failures] });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return progress;
}

// ZIP fallback: the server builds the ZIP from the originals it has; the browser downloads it
// through a short-lived link (a download can't carry the sign-in header).
export async function downloadSelectionZip(galleryId: number): Promise<void> {
  const res = await apiClient.post<{ url: string }>(`/api/photo-galleries/${galleryId}/selection-export/zip-link`);
  const base = (apiClient.defaults.baseURL ?? "").replace(/\/$/, "");
  const a = document.createElement("a");
  a.href = `${base}${res.data.url}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
