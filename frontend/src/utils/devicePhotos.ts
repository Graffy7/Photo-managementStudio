// Photos from the studio's OWN computer, for when the app is hosted online.
// The browser opens the computer's normal folder window, makes a screen-size copy (preview) of each
// JPEG / RAW photo right here on the computer, and uploads only that copy. The original files never
// leave the computer.

// Photos added this way are recorded under this "source" (matches the server).
export const DEVICE_SOURCE_PREFIX = "This computer › ";

export function isDeviceSource(source: string | null | undefined): boolean {
  return !!source && source.startsWith(DEVICE_SOURCE_PREFIX);
}

export function canPickFolder(): boolean {
  return typeof document !== "undefined" && "webkitdirectory" in document.createElement("input");
}

const JPEG = new Set(["jpg", "jpeg", "jpe"]);
const RAW = new Set(["cr2", "cr3", "nef", "nrw", "arw", "sr2", "srf", "dng", "raf", "orf", "rw2", "pef", "srw"]);
const VIDEO = new Set(["mp4", "mov", "avi", "mkv", "mts", "m2ts", "wmv", "m4v", "3gp", "mpg", "mpeg", "webm", "flv", "mxf"]);
// Windows / camera housekeeping files: left out without mentioning them.
const IGNORED = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);
const SELECTION_FOLDER = "customer selection";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function stemOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return (dot < 0 ? path : path.slice(0, dot)).toLowerCase();
}

export interface PickedPhoto {
  file: File;
  path: string; // inside the chosen folder, e.g. "Candid/IMG_0001.JPG"
}

export interface PickedFolder {
  name: string;
  photos: PickedPhoto[];
  skipped: { videos: number; other: number; rawWithJpeg: number; examples: string[] };
  handle?: DirHandle; // Chrome / Edge: the chosen folder itself, remembered for copying the picks back
}

// Opens the computer's folder window. Resolves null when the owner closes it without choosing.
// In Chrome / Edge the chosen folder is also remembered (see rememberFolder), so the customer's picks
// can later be copied back into it without choosing it again.
export async function pickFolder(): Promise<PickedFolder | null> {
  if (canCopyOnThisComputer()) {
    const started = Date.now();
    let handle: DirHandle;
    try {
      // "readwrite" now, so creating the Customer Selection folders later needs no further question.
      handle = await directoryPicker()({ id: "studio-photos", mode: "readwrite" });
    } catch (err) {
      // A real "Cancel" takes the owner a moment; an instant refusal means the window can't open here.
      if ((err as { name?: string }).name === "AbortError" && Date.now() - started > 700) return null;
      pickerBroken = true;
      throw new FolderWindowUnavailableError("The folder window didn't open. Click the button again.");
    }
    const entries: { file: File; path: string }[] = [];
    await walk(handle, "", entries);
    return { ...sortEntries(entries, handle.name), handle };
  }
  const files = await pickFolderFiles();
  return files ? sortFiles(files) : null;
}

async function walk(dir: DirHandle, prefix: string, out: { file: File; path: string }[], depth = 0) {
  if (depth > 12 || !dir.entries) return;
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "directory") {
      // Our own "Customer Selection" copies are never imported again.
      if (name.toLowerCase() !== SELECTION_FOLDER) await walk(entry as DirHandle, `${prefix}${name}/`, out, depth + 1);
    } else {
      out.push({ file: await (entry as FileHandle).getFile(), path: prefix + name });
    }
  }
}

// Every file in the folder the owner chooses (read-only; nothing is uploaded). Null when cancelled.
function pickFolderFiles(): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.style.display = "none";
    document.body.appendChild(input);
    const finish = (value: File[] | null) => {
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => finish(input.files && input.files.length > 0 ? Array.from(input.files) : null));
    input.addEventListener("cancel", () => finish(null));
    input.click();
  });
}

// Files from the classic folder window carry "Folder/sub/file.jpg" in webkitRelativePath.
export function sortFiles(files: File[]): PickedFolder | null {
  if (files.length === 0) return null;
  const withPath = files.map((file) => {
    const full = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
    const slash = full.indexOf("/");
    return { file, folder: slash < 0 ? "" : full.slice(0, slash), path: slash < 0 ? full : full.slice(slash + 1) };
  });
  return sortEntries(withPath, withPath[0].folder || "Photos");
}

// Keeps JPEG and RAW photos; a RAW whose JPEG twin is in the same folder is left out (same photo).
function sortEntries(entries: { file: File; path: string }[], name: string): PickedFolder {
  const skipped = { videos: 0, other: 0, rawWithJpeg: 0, examples: [] as string[] };
  const note = (file: File) => { if (skipped.examples.length < 5) skipped.examples.push(file.name); };
  const candidates: { file: File; path: string; kind: "jpeg" | "raw" }[] = [];

  for (const { file, path } of entries) {
    const segments = path.split("/");
    if (segments.slice(0, -1).some((s) => s.toLowerCase() === SELECTION_FOLDER)) continue;
    if (file.name.startsWith(".") || IGNORED.has(file.name.toLowerCase())) continue;
    const ext = extensionOf(file.name);
    if (JPEG.has(ext)) candidates.push({ file, path, kind: "jpeg" });
    else if (RAW.has(ext)) candidates.push({ file, path, kind: "raw" });
    else if (VIDEO.has(ext)) { skipped.videos++; note(file); }
    else { skipped.other++; note(file); }
  }

  const jpegStems = new Set(candidates.filter((c) => c.kind === "jpeg").map((c) => stemOf(c.path)));
  const photos: PickedPhoto[] = [];
  for (const c of candidates) {
    if (c.kind === "raw" && jpegStems.has(stemOf(c.path))) { skipped.rawWithJpeg++; continue; }
    photos.push({ file: c.file, path: c.path });
  }
  photos.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
  return { name, photos, skipped };
}

// ---- Remembering the photo folder (this computer only) --------------------------------------------
// The browser keeps a reference to the folder the photos were added from, per event, in its own
// storage on this computer. Nothing about the folder is sent to the server.

const DB_NAME = "studio-os-photo-folders";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("folders");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const folderKey = (galleryId: number, folderName: string) => `${galleryId}|${folderName.toLowerCase()}`;

export async function rememberFolder(galleryId: number, folderName: string, handle: DirHandle): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("folders", "readwrite");
      tx.objectStore("folders").put(handle, folderKey(galleryId, folderName));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Private windows can block storage; the owner is simply asked for the folder when copying.
  }
}

async function rememberedFolder(galleryId: number, folderName: string): Promise<DirHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const req = db.transaction("folders").objectStore("folders").get(folderKey(galleryId, folderName));
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

// ---- Making the preview ------------------------------------------------------------------------

const PREVIEW_EDGE = 1600;

// A screen-size JPEG of the photo, upright. RAW files carry a finished JPEG inside them (the one the
// camera shows on its screen); that one is used.
export async function makePreview(file: File): Promise<Blob> {
  const ext = extensionOf(file.name);
  if (!RAW.has(ext)) return render(await createImageBitmap(file), 1);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const embedded = largestEmbeddedJpeg(bytes);
  if (!embedded) throw new Error("No preview inside this RAW file.");
  const jpeg = bytes.slice(embedded.start, embedded.end);
  // If the inner JPEG says which way is up, the browser follows it; otherwise the RAW's own tag does.
  const rotate = jpegOrientation(jpeg) > 1 ? 1 : rawOrientation(bytes, ext);
  return render(await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" })), rotate);
}

async function render(bitmap: ImageBitmap, orientation: number): Promise<Blob> {
  try {
    const swap = orientation >= 5 && orientation <= 8;
    const scale = Math.min(1, PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't make previews.");
    ctx.imageSmoothingQuality = "high";
    applyOrientation(ctx, orientation, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error("Couldn't make a preview.");
    return blob;
  } finally {
    bitmap.close();
  }
}

// EXIF orientation 1-8 as a canvas transform (w/h are the drawn, un-rotated size).
function applyOrientation(ctx: CanvasRenderingContext2D, o: number, w: number, h: number) {
  switch (o) {
    case 2: ctx.setTransform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.setTransform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.setTransform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.setTransform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.setTransform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.setTransform(0, -1, -1, 0, h, w); break;
    case 8: ctx.setTransform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
}

// Baseline / progressive JPEGs only - the lossless ones inside some RAWs are raw sensor data.
const DECODABLE_SOF = new Set([0xc0, 0xc1, 0xc2]);

// Every JPEG inside the file, keeping the one with the most pixels.
function largestEmbeddedJpeg(b: Uint8Array): { start: number; end: number } | null {
  let best: { start: number; end: number; pixels: number } | null = null;
  for (let i = 0; i < b.length - 3; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue;
    const found = readJpeg(b, i);
    if (found && (!best || found.pixels > best.pixels)) best = found;
    if (found) i = found.end - 1;
  }
  return best && best.pixels >= 160 * 120 ? { start: best.start, end: best.end } : null;
}

function readJpeg(b: Uint8Array, start: number): { start: number; end: number; pixels: number } | null {
  let p = start + 2;
  let pixels = 0;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1];
    if (marker === 0xff) { p++; continue; }
    const length = (b[p + 2] << 8) | b[p + 3];
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (!DECODABLE_SOF.has(marker) || p + 9 > b.length) return null;
      pixels = ((b[p + 5] << 8) | b[p + 6]) * ((b[p + 7] << 8) | b[p + 8]);
    }
    if (marker === 0xda) {
      if (!pixels) return null;
      // Inside the image data a real 0xFF is always followed by 0x00 or a restart marker,
      // so the first FF D9 is the end.
      for (let q = p + 2 + length; q < b.length - 1; q++) {
        if (b[q] === 0xff && b[q + 1] === 0xd9) return { start, end: q + 2, pixels };
      }
      return null;
    }
    p += 2 + length;
  }
  return null;
}

// Orientation from a JPEG's own EXIF block (0 when it has none).
function jpegOrientation(b: Uint8Array): number {
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1];
    const length = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xda) break;
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      return tiffOrientation(b, p + 10);
    }
    p += 2 + length;
  }
  return 0;
}

// Orientation tag (0x0112) of a RAW: TIFF-based files keep it in the first directory; Canon CR3 keeps
// the same directory in its "CMT1" box.
function rawOrientation(b: Uint8Array, ext: string): number {
  if (ext === "cr3") {
    const limit = Math.min(b.length - 4, 1 << 20);
    for (let i = 0; i < limit; i++) {
      if (b[i] === 0x43 && b[i + 1] === 0x4d && b[i + 2] === 0x54 && b[i + 3] === 0x31) return tiffOrientation(b, i + 4) || 1;
    }
    return 1;
  }
  return tiffOrientation(b, 0) || 1;
}

function tiffOrientation(b: Uint8Array, base: number): number {
  if (base + 8 > b.length) return 0;
  const little = b[base] === 0x49 && b[base + 1] === 0x49;
  const big = b[base] === 0x4d && b[base + 1] === 0x4d;
  if (!little && !big) return 0;
  const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000 : b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]));
  const ifd = base + u32(base + 4);
  if (ifd + 2 > b.length) return 0;
  const count = u16(ifd);
  for (let n = 0; n < count && ifd + 2 + n * 12 + 12 <= b.length; n++) {
    const entry = ifd + 2 + n * 12;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 0;
    }
  }
  return 0;
}

// ---- Uploading ----------------------------------------------------------------------------------

export interface DeviceImportProgress {
  total: number;
  done: number;
  added: number;
  alreadyThere: number;
  failed: number;
  failedNames: string[];
}

export interface DeviceImportApi {
  present: (folder: string) => Promise<string[]>;
  upload: (folder: string, path: string, preview: Blob, originalSize: number) => Promise<void>;
  done: (folder: string, added: number, skipped: number, failed: number) => Promise<void>;
}

// Sends every photo not already in the gallery, three at a time. A photo that can't be read is
// counted and reported; the rest carry on.
export async function importPickedFolder(
  picked: PickedFolder,
  api: DeviceImportApi,
  onProgress: (p: DeviceImportProgress) => void,
  signal?: { cancelled: boolean },
): Promise<DeviceImportProgress> {
  const present = new Set((await api.present(picked.name)).map((p) => p.toLowerCase()));
  const todo = picked.photos.filter((p) => !present.has(normalise(p.path)));
  const progress: DeviceImportProgress = {
    total: picked.photos.length, done: picked.photos.length - todo.length,
    added: 0, alreadyThere: picked.photos.length - todo.length, failed: 0, failedNames: [],
  };
  onProgress({ ...progress });

  // Previews are made three at a time, but sent in folder order so photo numbers follow the file names.
  const sent: Promise<void>[] = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length && !signal?.cancelled) {
      const index = next++;
      const photo = todo[index];
      const previous = sent[index - 1];
      let release!: () => void;
      sent[index] = new Promise<void>((r) => { release = r; });
      try {
        const preview = await makePreview(photo.file);
        await previous;
        await withRetry(() => api.upload(picked.name, photo.path, preview, photo.file.size));
        progress.added++;
      } catch {
        await previous;
        progress.failed++;
        if (progress.failedNames.length < 5) progress.failedNames.push(photo.file.name);
      }
      release();
      progress.done++;
      onProgress({ ...progress, failedNames: [...progress.failedNames] });
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const skippedTotal = picked.skipped.videos + picked.skipped.other + picked.skipped.rawWithJpeg;
  await api.done(picked.name, progress.added, skippedTotal, progress.failed).catch(() => undefined);
  return progress;
}

function normalise(path: string): string {
  return path.split("/").map((s) => s.trim()).filter(Boolean).join("/").toLowerCase();
}

// A dropped connection or a busy server gets two more tries; a refused photo (400) doesn't.
async function withRetry(send: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const retryable = status === undefined || status >= 500 || status === 429;
      if (!retryable || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

// ---- Copying the customer's picks on this computer -----------------------------------------------

export interface DeviceSelectionFile {
  source: string;
  relativePath: string;
  fileName: string;
  selectionType: string; // "Normal" | "Big Size"
}

// Chrome / Edge can read and write a chosen folder. Some browsers inside other apps (Electron-based
// ones) have the function but it cancels at once without showing anything - they use the classic
// folder window and the ZIP download instead.
let pickerBroken = false;

export function canCopyOnThisComputer(): boolean {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window) || pickerBroken) return false;
  return !/Electron|Claude\//.test(navigator.userAgent);
}

// Thrown when the folder window turned out not to work here; the next click uses the classic one.
export class FolderWindowUnavailableError extends Error {}

type FileHandle = {
  kind: "file";
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
};

type DirHandle = {
  kind: "directory";
  name: string;
  getDirectoryHandle: (name: string, o?: { create?: boolean }) => Promise<DirHandle>;
  getFileHandle: (name: string, o?: { create?: boolean }) => Promise<FileHandle>;
  removeEntry?: (name: string) => Promise<void>;
  values?: () => AsyncIterable<{ kind: string; name: string }>;
  entries?: () => AsyncIterable<[string, FileHandle | DirHandle]>;
  queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

export type { DirHandle };

function directoryPicker() {
  return (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
}

export interface CopyResult { copied: number; missing: string[]; folders: string[]; selectionFolders: DirHandle[]; asked: boolean }

// The photo folder each source came from: the one remembered from "Add photos" (the browser may ask
// "Allow editing?" once), otherwise the owner chooses it. Called straight from the button press,
// since the browser only shows those questions right after a click.
export async function openPhotoFolders(galleryId: number, sources: string[]): Promise<{ folders: Map<string, DirHandle>; asked: boolean }> {
  const folders = new Map<string, DirHandle>();
  let asked = false;
  for (const source of sources) {
    const remembered = await rememberedFolder(galleryId, source);
    if (remembered?.requestPermission) {
      const state = (await remembered.queryPermission?.({ mode: "readwrite" })) === "granted"
        ? "granted"
        : await remembered.requestPermission({ mode: "readwrite" }).catch(() => "denied" as PermissionState);
      if (state === "granted") {
        folders.set(source.toLowerCase(), remembered);
        continue;
      }
    }
    // Not remembered on this computer (another PC, or added before this existed): choose it once.
    asked = true;
    const chosen = await directoryPicker()({ id: "studio-photos", mode: "readwrite", ...(remembered ? { startIn: remembered } : {}) });
    folders.set(source.toLowerCase(), chosen);
    await rememberFolder(galleryId, source, chosen);
  }
  return { folders, asked };
}

// The picks are copied into "<photo folder>\Customer Selection\Normal" and "...\Big Size". Files there
// that are no longer picked are removed, so pressing it again after the customer changes their mind
// brings it up to date.
export async function copySelectionOnThisComputer(
  folders: Map<string, DirHandle>,
  files: DeviceSelectionFile[],
  onProgress: (done: number, total: number) => void,
): Promise<Omit<CopyResult, "asked">> {
  const targets = new Map<DirHandle, { selection: DirHandle; dirs: Record<string, DirHandle>; wanted: Record<string, Set<string>> }>();
  const targetFor = async (root: DirHandle) => {
    let t = targets.get(root);
    if (!t) {
      const selection = await root.getDirectoryHandle("Customer Selection", { create: true });
      t = { selection, dirs: {}, wanted: {} };
      for (const type of ["Normal", "Big Size"]) {
        t.dirs[type] = await selection.getDirectoryHandle(type, { create: true });
        t.wanted[type] = new Set();
      }
      targets.set(root, t);
    }
    return t;
  };

  const missing: string[] = [];
  let copied = 0;
  let done = 0;
  for (const f of files) {
    const type = f.selectionType === "Big Size" ? "Big Size" : "Normal";
    try {
      const root = folders.get(f.source.toLowerCase()) ?? [...folders.values()][0];
      if (!root) throw new Error("No folder");
      // Normally the photo folder itself; if the owner chose the folder above it, look inside.
      const base = f.source.toLowerCase() === root.name.toLowerCase() ? root : await root.getDirectoryHandle(f.source).catch(() => root);
      const original = await openRelative(base, f.relativePath);
      const t = await targetFor(root);
      const outName = f.relativePath.split("/").pop() ?? f.fileName;
      t.wanted[type].add(outName.toLowerCase());
      const out = await t.dirs[type].getFileHandle(outName, { create: true });
      const existing = await out.getFile();
      if (existing.size !== original.size) {
        const writer = await out.createWritable();
        await writer.write(original);
        await writer.close();
      }
      copied++;
    } catch {
      missing.push(f.relativePath);
    }
    onProgress(++done, files.length);
  }

  // Photos the customer has since un-picked (or moved to the other size).
  for (const t of targets.values()) {
    for (const type of Object.keys(t.dirs)) {
      const dir = t.dirs[type];
      if (!dir.values || !dir.removeEntry) continue;
      const stale: string[] = [];
      for await (const entry of dir.values()) {
        if (entry.kind === "file" && !t.wanted[type].has(entry.name.toLowerCase())) stale.push(entry.name);
      }
      for (const name of stale) await dir.removeEntry(name).catch(() => undefined);
    }
  }
  return {
    copied,
    missing,
    folders: [...targets.keys()].map((r) => `${r.name}\\Customer Selection`),
    selectionFolders: [...targets.values()].map((t) => t.selection),
  };
}

// Opens the computer's file window already inside "Customer Selection", so the owner sees where the
// folders are (the address bar shows the full path). A website can't open File Explorer itself.
export async function showFolderOnComputer(folder: DirHandle): Promise<void> {
  const picker = (window as unknown as { showOpenFilePicker?: (o: object) => Promise<unknown> }).showOpenFilePicker;
  if (!picker) return;
  try {
    await picker({ startIn: folder, multiple: true });
  } catch {
    // Closing the window is the normal way out.
  }
}

async function openRelative(root: DirHandle, relativePath: string): Promise<File> {
  const parts = relativePath.split("/").filter(Boolean);
  let dir = root;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
}
