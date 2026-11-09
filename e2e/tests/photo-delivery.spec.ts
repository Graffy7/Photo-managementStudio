import { it, expect, authFile, apiAs, uid, mobileNo } from "./fixtures";
import { goTo } from "./helpers";
import { chromium, request, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { QA } from "../qa.config";

// Phase 2 - photo delivery, end to end, with real JPEG files made for this run (never real
// customer photos): 4000x3000 camera-size photos with real pixel content, one stored sideways with
// an EXIF orientation tag (as a phone/camera held upright writes it), a small one that must not be
// blown up, a broken .jpg, a video and a text file that must be skipped.
const tag = uid();
const folderName = `QA Wedding ${tag}`;
const srcRoot = path.join(QA.photosDir, tag);
const srcFolder = path.join(srcRoot, folderName);
const customerName = `QA Photo Customer ${tag}`;

type Photo = { photoId: number; fileName: string; thumbnailUrl: string | null; previewUrl: string | null; width: number; height: number; selectionType: string | null; folderId: number | null };

let owner: APIRequestContext;
let galleryId = 0;
let eventId = 0;
let serverEventId = 0;
let serverGalleryId = 0;
let customerLink = "";
let token = "";

// ---- Test photos ------------------------------------------------------------------------------

// Draws a photo in the browser and returns the JPEG bytes. The top 12% of the upright picture is
// solid red, so "which way is up" can be checked on the server's previews later. sideways = the
// pixels are stored turned 90° to the left and an EXIF tag says "rotate 90° right to show".
async function makeJpeg(page: Page, w: number, h: number, label: string, sideways = false): Promise<Buffer> {
  const b64 = await page.evaluate(async ({ w, h, label, sideways }) => {
    const up = document.createElement("canvas");
    up.width = w; up.height = h;
    const c = up.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1d3b6e"); g.addColorStop(1, "#3fa37a");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Fine noise, like a real photo (and real-photo file sizes).
    const img = c.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    c.putImageData(img, 0, 0);
    c.fillStyle = "#e00000"; c.fillRect(0, 0, w, Math.round(h * 0.12));
    c.fillStyle = "#ffffff"; c.font = `bold ${Math.round(Math.min(w, h) / 8)}px sans-serif`;
    c.fillText(label, Math.round(w * 0.08), Math.round(h * 0.55));
    let out = up;
    if (sideways) {
      out = document.createElement("canvas");
      out.width = h; out.height = w;
      const r = out.getContext("2d")!;
      r.translate(0, w); r.rotate(-Math.PI / 2); r.drawImage(up, 0, 0);
    }
    const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), "image/jpeg", 0.92));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, { w, h, label, sideways });
  const jpeg = Buffer.from(b64, "base64");
  if (!sideways) return jpeg;
  // APP1 "Exif" block with a single tag: Orientation (0x0112) = 6.
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function writePhotos(dir: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const put = (rel: string, data: Buffer | string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), data);
  };
  put("Ceremony/IMG_0001.jpg", await makeJpeg(page, 4000, 3000, "IMG 0001"));
  put("Ceremony/IMG_0002.jpg", await makeJpeg(page, 4000, 3000, "IMG 0002"));
  put("Reception/IMG_0003.jpg", await makeJpeg(page, 4000, 3000, "IMG 0003"));
  put("Reception/IMG_0004_portrait.jpg", await makeJpeg(page, 3000, 4000, "IMG 0004", true));
  put("Reception/IMG_0005_small.jpg", await makeJpeg(page, 800, 600, "IMG 0005"));
  put("Reception/broken.jpg", Buffer.from("this is not really a jpeg file ".repeat(50)));
  put("Ceremony/clip.mp4", Buffer.alloc(4096, 7));
  put("notes.txt", "QA notes - not a photo");
  await browser.close();
}

const GOOD_PHOTOS = ["IMG_0001.jpg", "IMG_0002.jpg", "IMG_0003.jpg", "IMG_0004_portrait.jpg", "IMG_0005_small.jpg"];

// ---- Helpers ----------------------------------------------------------------------------------

const abs = (u: string) => new URL(u, QA.apiUrl).toString();

async function photosOf(api: APIRequestContext, id: number): Promise<Photo[]> {
  const res = await api.get(`/api/photo-galleries/${id}/photos?pageSize=100`);
  expect(res.ok(), "owner lists the gallery's photos").toBeTruthy();
  return (await res.json()).items;
}

// Decodes an image in the browser: its size and the average colour of its top and bottom strips.
async function inspectImage(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const blob = await (await fetch(u)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext("2d")!;
    x.drawImage(bmp, 0, 0);
    const avg = (y0: number, y1: number) => {
      const d = x.getImageData(0, y0, bmp.width, Math.max(1, y1 - y0)).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    };
    return { type: blob.type, bytes: blob.size, width: bmp.width, height: bmp.height, top: avg(0, Math.round(bmp.height * 0.06)), bottom: avg(Math.round(bmp.height * 0.9), bmp.height) };
  }, url);
}
const isRed = (c: { r: number; g: number; b: number }) => c.r > 180 && c.g < 70 && c.b < 70;

async function openGallery(page: Page) {
  await page.goto("/");
  await goTo(page, "Photo delivery");
  await page.getByPlaceholder("Search by customer or venue").filter({ visible: true }).fill(`QA Hall ${tag}`);
  await page.getByText(`QA Hall ${tag}`).filter({ visible: true }).first().click();
  await expect(page.getByText("Add the photos").filter({ visible: true })).toBeVisible();
}

// The "folder window" in Chromium is the File System Access picker, which a test can't drive; the
// classic folder window (what Firefox/Safari use, and Chrome when that picker fails) is used instead.
async function useClassicFolderWindow(page: Page) {
  await page.addInitScript(() => {
    delete (Window.prototype as unknown as Record<string, unknown>).showDirectoryPicker;
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
}

async function chooseFolder(page: Page, dir: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByText(/^(Choose folder on this computer|Add photos from this computer)$/).filter({ visible: true }).click();
  await (await chooser).setFiles(dir);
}

// ---- Tests ------------------------------------------------------------------------------------

it.use({ storageState: authFile("a") });

it.describe.serial("Phase 2 - Photo delivery", () => {
  it.beforeAll(async () => {
    await writePhotos(srcFolder);
    owner = (await apiAs("a")).api;
    const cust = await owner.post("/api/customers", { data: { fullName: customerName, mobileNumber: mobileNo() } });
    expect(cust.ok(), "QA customer created").toBeTruthy();
    const customerId = (await cust.json()).customerId;
    const day = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    for (const venue of [`QA Hall ${tag}`, `QA Server Hall ${tag}`]) {
      const ev = await owner.post("/api/events", { data: { customerId, eventDate: day, eventStatus: "Completed", venue } });
      expect(ev.ok(), `completed QA event at ${venue}`).toBeTruthy();
      const id = (await ev.json()).eventId;
      if (venue.startsWith("QA Hall")) eventId = id; else serverEventId = id;
    }
  });

  it.afterAll(async () => { await owner?.dispose(); });

  it("gallery creation: opening the completed event from Photo delivery creates its gallery", async ({ page }) => {
    await openGallery(page);
    const res = await owner.post(`/api/photo-galleries/events/${eventId}`);
    expect(res.ok()).toBeTruthy();
    const g = await res.json();
    galleryId = g.galleryId;
    expect(galleryId).toBeGreaterThan(0);
    expect(g.counts.total, "a new gallery starts empty").toBe(0);
    // Opening it again gives the same gallery, not a second one.
    expect((await (await owner.post(`/api/photo-galleries/events/${eventId}`)).json()).galleryId).toBe(galleryId);
  });

  it("upload: real photos from a folder are added; the broken file, the video and the text file are not", async ({ page }) => {
    await useClassicFolderWindow(page);
    await openGallery(page);
    await chooseFolder(page, srcFolder);
    await expect(page.getByText(`5 photos added from "${folderName}".`, { exact: false }).filter({ visible: true })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/couldn't be read.*broken\.jpg/).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/1 video/).filter({ visible: true })).toBeVisible();

    const photos = await photosOf(owner, galleryId);
    expect(photos.map((p) => p.fileName).sort()).toEqual([...GOOD_PHOTOS].sort());
  });

  it("thumbnails and previews: made for every photo, right size, WebP, upright, not blown up, nothing leaks", async ({ page }) => {
    await page.goto("/");
    const photos = await photosOf(owner, galleryId);
    for (const p of photos) {
      expect(p.thumbnailUrl, `${p.fileName} has a thumbnail`).toBeTruthy();
      expect(p.previewUrl, `${p.fileName} has a preview`).toBeTruthy();
      const preview = await inspectImage(page, abs(p.previewUrl!));
      const thumb = await inspectImage(page, abs(p.thumbnailUrl!));
      expect(preview.type, "previews are WebP").toBe("image/webp");
      expect(thumb.type).toBe("image/webp");
      expect(Math.max(thumb.width, thumb.height), `${p.fileName} thumbnail long edge`).toBeLessThanOrEqual(360);
      expect(preview.width, "stored size matches the file").toBe(p.width);
      expect(preview.height).toBe(p.height);
      expect(isRed(preview.top), `${p.fileName}: the red band is at the top (upright) - got ${JSON.stringify(preview.top)}`).toBeTruthy();
      expect(isRed(preview.bottom), `${p.fileName}: not upside-down`).toBeFalsy();
      expect(isRed(thumb.top), `${p.fileName}: thumbnail upright too`).toBeTruthy();

      if (p.fileName === "IMG_0005_small.jpg") {
        expect([preview.width, preview.height], "a small photo is kept at its own size, not enlarged").toEqual([800, 600]);
      } else if (p.fileName === "IMG_0004_portrait.jpg") {
        expect([preview.width, preview.height], "the sideways-stored portrait comes out portrait").toEqual([1200, 1600]);
      } else {
        expect([preview.width, preview.height], "a 4000x3000 photo becomes a 1600px preview").toEqual([1600, 1200]);
      }
      // Quality: big enough to look at closely, small enough to load quickly.
      expect(preview.bytes, `${p.fileName} preview size`).toBeGreaterThan(p.fileName.includes("small") ? 5_000 : 30_000);
      expect(preview.bytes).toBeLessThan(1_500_000);
      expect(thumb.bytes).toBeLessThan(150_000);
    }

    // The preview files carry no EXIF (no camera serial, GPS...).
    const raw = Buffer.from(await (await owner.get(abs(photos[0].previewUrl!))).body());
    expect(raw.includes(Buffer.from("Exif"))).toBeFalsy();
    // A signed link that has been altered is refused.
    const tampered = abs(photos[0].previewUrl!).replace(/sig=([^&]+)/, (_m, s: string) => `sig=${s.slice(0, -2)}xx`);
    expect((await owner.get(tampered)).status()).toBe(403);
    const unsigned = abs(photos[0].previewUrl!).split("?")[0];
    expect((await owner.get(unsigned)).status()).toBe(403);
  });

  it("duplicates: choosing the same folder again adds nothing; the server refuses a repeat upload too", async ({ page }) => {
    await useClassicFolderWindow(page);
    await openGallery(page);
    await chooseFolder(page, srcFolder);
    await expect(page.getByText(/0 photos added from/).filter({ visible: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/5 photos were already in the gallery/).filter({ visible: true })).toBeVisible();
    expect(await photosOf(owner, galleryId)).toHaveLength(5);

    // Straight to the API: the same photo path again is "AlreadyThere", never a second copy.
    const again = await owner.post(`/api/photo-galleries/${galleryId}/device-photos`, {
      multipart: {
        file: { name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join(srcFolder, "Ceremony/IMG_0001.jpg")) },
        folder: folderName, path: "Ceremony/IMG_0001.jpg", size: String(fs.statSync(path.join(srcFolder, "Ceremony/IMG_0001.jpg")).size),
      },
    });
    expect(again.ok()).toBeTruthy();
    expect((await again.json()).outcome).toBe("AlreadyThere");
    expect(await photosOf(owner, galleryId)).toHaveLength(5);

    // Something that isn't a photo is refused by the server even if the browser sent it.
    const text = await owner.post(`/api/photo-galleries/${galleryId}/device-photos`, {
      multipart: { file: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }, folder: folderName, path: "notes.txt" },
    });
    expect(text.status()).toBe(400);
    const fake = await owner.post(`/api/photo-galleries/${galleryId}/device-photos`, {
      multipart: { file: { name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image at all") }, folder: folderName, path: "fake.jpg" },
    });
    expect(fake.status()).toBe(400);
    const escape = await owner.post(`/api/photo-galleries/${galleryId}/device-photos`, {
      multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join(srcFolder, "Reception/IMG_0005_small.jpg")) }, folder: folderName, path: "../../outside.jpg" },
    });
    expect(escape.status(), "a path that climbs out of the folder is refused").toBe(400);
    expect(await photosOf(owner, galleryId)).toHaveLength(5);
  });

  it("server folder import: originals inside the studio's own photo folder; orientation, duplicates and folder limits", async () => {
    // The studio's server photo folder is <photoRootBase>/<studioId> (QA setting).
    const studioId = (await (await owner.get("/api/auth/me")).json()).studioId as number;
    const root = path.join(QA.photoRootBase, String(studioId));
    const dest = path.join(root, `QA Server ${tag}`);
    fs.cpSync(srcFolder, dest, { recursive: true });

    const g = await (await owner.post(`/api/photo-galleries/events/${serverEventId}`)).json();
    serverGalleryId = g.galleryId;
    const start = await owner.post(`/api/photo-galleries/${serverGalleryId}/import`, { data: { sourceFolder: dest } });
    expect(start.status(), await start.text()).toBe(202);
    const jobId = (await start.json()).jobId ?? (await start.json()).importJobId;
    await expect.poll(async () => (await (await owner.get(`/api/photo-galleries/${serverGalleryId}/import/${jobId}`)).json()).status, { timeout: 120_000 })
      .toMatch(/Completed|CompletedWithErrors|Done|Finished/i);

    const photos = await photosOf(owner, serverGalleryId);
    expect(photos.map((p) => p.fileName).sort(), "the five real photos; the broken file is left out").toEqual([...GOOD_PHOTOS].sort());
    const portrait = photos.find((p) => p.fileName === "IMG_0004_portrait.jpg")!;
    expect([portrait.width, portrait.height], "server-made preview follows the EXIF orientation").toEqual([1200, 1600]);
    const small = photos.find((p) => p.fileName === "IMG_0005_small.jpg")!;
    expect([small.width, small.height]).toEqual([800, 600]);

    // Importing the same folder again only retries the file that failed (broken.jpg) - the five
    // photos already in the gallery are not added a second time.
    const retry = await owner.post(`/api/photo-galleries/${serverGalleryId}/import`, { data: { sourceFolder: dest } });
    expect(retry.status()).toBe(202);
    const retryJob = (await retry.json()).jobId;
    await expect.poll(async () => (await (await owner.get(`/api/photo-galleries/${serverGalleryId}/import/${retryJob}`)).json()).status, { timeout: 60_000 })
      .toMatch(/Completed|CompletedWithErrors|Failed/);
    expect(await photosOf(owner, serverGalleryId), "no duplicates after a second import").toHaveLength(5);
    // With only good photos left, a third import has nothing to do.
    fs.rmSync(path.join(dest, "Reception", "broken.jpg"));
    const again = await owner.post(`/api/photo-galleries/${serverGalleryId}/import`, { data: { sourceFolder: dest } });
    expect(again.status(), await again.text()).toBe(409);
    expect((await again.json()).code).toBe("ALREADY_IMPORTED");
    // Outside the studio's own folder (e.g. another studio's, or the QA uploads) is refused.
    const outside = await owner.post(`/api/photo-galleries/${serverGalleryId}/import`, { data: { sourceFolder: srcFolder } });
    expect(outside.status()).toBe(403);
    expect((await outside.json()).code).toBe("OUTSIDE_PHOTO_ROOT");
    const climb = await owner.post(`/api/photo-galleries/${serverGalleryId}/import`, { data: { sourceFolder: path.join(root, "..", "..") } });
    expect([400, 403]).toContain(climb.status());
    const browse = await owner.get(`/api/photo-galleries/browse-folders?path=${encodeURIComponent(QA.photoRootBase)}`);
    expect([400, 403], "can't browse above the studio's folder").toContain(browse.status());
  });

  it("customer link: generated in the UI, opens without signing in, every image loads", async ({ page, browser }) => {
    await openGallery(page);
    await page.getByText("5 days", { exact: true }).filter({ visible: true }).click();
    await page.getByText("Generate link", { exact: true }).filter({ visible: true }).click();
    const linkText = page.getByRole("link").filter({ hasText: "/photo-selection/" }).filter({ visible: true }).first();
    await expect(linkText).toBeVisible();
    customerLink = (await linkText.innerText()).trim();
    token = customerLink.split("/photo-selection/")[1];
    expect(token.length).toBeGreaterThan(20);
    await expect(page.getByText(/5 days left|4 days left/).filter({ visible: true })).toBeVisible();

    // The customer: a fresh browser with no sign-in at all.
    const ctx = await browser.newContext();
    const cust = await ctx.newPage();
    const errors: string[] = [];
    cust.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_NAME_NOT_RESOLVED/.test(m.text())) errors.push(m.text()); });
    cust.on("response", (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
    await cust.goto(`/photo-selection/${token}`);
    await expect(cust.getByText("Your photos", { exact: true }).first()).toBeVisible();
    await expect(cust.getByText(/5 photos/).first()).toBeVisible();
    const folders = cust.getByRole("button", { name: /, \d+ photos/ });
    expect(await folders.count(), "the customer sees folders to open").toBeGreaterThan(0);
    await folders.first().click();
    const imgs = cust.locator("img");
    await expect(imgs.first()).toBeVisible();
    await expect.poll(() => cust.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
    const broken = await cust.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    expect(broken, "no broken images in the customer's gallery").toEqual([]);
    await expect(cust.getByText("Couldn't load · tap to retry")).toHaveCount(0);
    expect(errors, "no API or console errors for the customer").toEqual([]);
    await ctx.close();
  });

  it("customer selection: select, change size, deselect, submit; the owner sees exactly that", async ({ browser }) => {
    const pub = await request.newContext({ baseURL: QA.apiUrl });
    const base = `/api/public/photo-selection/${token}`;
    const all: Photo[] = (await (await pub.get(`${base}/photos?pageSize=100`)).json()).items;
    expect(all).toHaveLength(5);

    // In the browser, as the customer would.
    const ctx = await browser.newContext();
    const cust = await ctx.newPage();
    await cust.goto(`/photo-selection/${token}`);
    await cust.getByRole("button", { name: /, \d+ photos/ }).first().click();
    const first = cust.getByText("Select", { exact: true }).first();
    await first.click();
    await expect(cust.getByRole("button", { name: /^Unselect / }).first()).toBeVisible();
    await expect.poll(async () => (await (await pub.get(`${base}/summary`)).json()).selected).toBe(1);
    // Deselect in the browser.
    await cust.getByRole("button", { name: /^Unselect / }).first().click();
    await expect.poll(async () => { const s = await (await pub.get(`${base}/summary`)).json(); return s.selected; }).toBe(0);
    await ctx.close();

    // Through the API: 3 picks, one changed to Big, one removed again.
    const [a, b, c] = all;
    expect((await pub.put(`${base}/photos/${a.photoId}`, { data: { selectionType: 1 } })).ok()).toBeTruthy();
    expect((await pub.put(`${base}/photos/${b.photoId}`, { data: { selectionType: 1 } })).ok()).toBeTruthy();
    expect((await pub.put(`${base}/photos/${c.photoId}`, { data: { selectionType: 2 } })).ok()).toBeTruthy();
    expect((await pub.put(`${base}/photos/${b.photoId}`, { data: { selectionType: 2 } })).ok(), "change Normal → Big").toBeTruthy();
    expect((await pub.delete(`${base}/photos/${c.photoId}`)).ok(), "deselect").toBeTruthy();
    expect((await pub.put(`${base}/photos/${a.photoId}`, { data: { selectionType: 3 } })).status(), "only Normal (1) or Big (2)").toBe(400);
    expect((await pub.put(`${base}/photos/999999999`, { data: { selectionType: 1 } })).status(), "a photo not in this gallery").toBe(404);

    const summary = await (await pub.get(`${base}/summary`)).json();
    const submit = await pub.post(`${base}/submit`);
    expect(submit.ok(), await submit.text()).toBeTruthy();

    const ownerPhotos = await photosOf(owner, galleryId);
    const picked = Object.fromEntries(ownerPhotos.filter((p) => p.selectionType).map((p) => [p.photoId, p.selectionType]));
    expect(picked, "owner sees exactly the customer's picks").toEqual({ [a.photoId]: "Normal", [b.photoId]: "Big" });
    const g = await (await owner.get(`/api/photo-galleries/${galleryId}`)).json();
    expect(g.submittedAt, "submitted").toBeTruthy();
    expect(summary.selected, "customer summary: 2 picked").toBe(2);
    expect(summary.total).toBe(5);
    await pub.dispose();
  });

  it("lock: a locked selection can't be changed by the customer; unlock allows it again", async () => {
    const pub = await request.newContext({ baseURL: QA.apiUrl });
    const base = `/api/public/photo-selection/${token}`;
    const all: Photo[] = (await (await pub.get(`${base}/photos?pageSize=100`)).json()).items;
    expect((await owner.post(`/api/photo-galleries/${galleryId}/lock`)).status()).toBe(204);
    const blocked = await pub.put(`${base}/photos/${all[4].photoId}`, { data: { selectionType: 1 } });
    expect(blocked.status(), "change refused while locked").toBe(409);
    expect((await owner.post(`/api/photo-galleries/${galleryId}/unlock`)).status()).toBe(204);
    expect((await pub.put(`${base}/photos/${all[4].photoId}`, { data: { selectionType: 1 } })).ok()).toBeTruthy();
    expect((await pub.delete(`${base}/photos/${all[4].photoId}`)).ok()).toBeTruthy();
    await pub.dispose();
  });

  it("isolation: QA Studio Beta can't see, change or link Alpha's photos", async () => {
    const { api: beta } = await apiAs("b");
    for (const url of [`/api/photo-galleries/${galleryId}`, `/api/photo-galleries/${galleryId}/photos`, `/api/photo-galleries/${galleryId}/export`,
      `/api/photo-galleries/${galleryId}/selection-export`, `/api/photo-galleries/${galleryId}/device-photos?folder=${encodeURIComponent(folderName)}`,
      `/api/photo-galleries/${galleryId}/device-photos/selection`]) {
      const r = await beta.get(url);
      expect([403, 404], `Beta GET ${url}`).toContain(r.status());
      expect(await r.text()).not.toContain("IMG_0001");
    }
    for (const [method, url, data] of [
      ["post", `/api/photo-galleries/${galleryId}/link`, { expiresInDays: 5 }],
      ["delete", `/api/photo-galleries/${galleryId}/link`, undefined],
      ["post", `/api/photo-galleries/${galleryId}/lock`, undefined],
      ["post", `/api/photo-galleries/${galleryId}/imported-folders/remove`, { sourceFolder: `This computer › ${folderName}` }],
      ["post", `/api/photo-galleries/events/${eventId}`, undefined],
    ] as const) {
      const r = await (beta as unknown as Record<string, (u: string, o?: object) => Promise<{ status(): number }>>)[method](url, data ? { data } : undefined);
      expect([403, 404], `Beta ${method.toUpperCase()} ${url}`).toContain(r.status());
    }
    const up = await beta.post(`/api/photo-galleries/${galleryId}/device-photos`, {
      multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join(srcFolder, "Reception/IMG_0005_small.jpg")) }, folder: "Beta", path: "x.jpg" },
    });
    expect([403, 404]).toContain(up.status());
    // Beta's completed-events list doesn't include Alpha's event.
    const list = await (await beta.get(`/api/photo-galleries/completed-events?search=${encodeURIComponent(customerName)}`)).json();
    expect(JSON.stringify(list)).not.toContain(customerName);
    // Nothing changed for Alpha.
    expect(await photosOf(owner, galleryId)).toHaveLength(5);
    expect((await (await owner.get(`/api/photo-galleries/${galleryId}`)).json()).isLinkActive ?? true).toBeTruthy();
    await beta.dispose();
  });

  it("retention: previews are kept while the link runs, removed 10 days after it was sent, and the link then can't be resent", async () => {
    const { api: admin } = await apiAs("admin");
    const now = Date.now();
    const plan = (asOf: number) => admin.get(`/api/admin/photo-cleanup?galleryId=${galleryId}&asOf=${new Date(asOf).toISOString()}`).then((r) => r.json());

    const today = await plan(now);
    expect(today.eligible.map((e: { galleryId: number }) => e.galleryId), "nothing to remove today").not.toContain(galleryId);
    const day4 = await plan(now + 4 * 86400000);
    expect(day4.eligible.map((e: { galleryId: number }) => e.galleryId), "link still running on day 4").not.toContain(galleryId);
    const day11 = await plan(now + 11 * 86400000);
    const entry = day11.eligible.find((e: { galleryId: number }) => e.galleryId === galleryId);
    expect(entry, "eligible 11 days after the link was sent").toBeTruthy();
    expect(entry.rule).toBe("ExpiredLink");
    expect(entry.files.length, "thumbnail + preview for each of the 5 photos").toBe(10);

    // The dry run deleted nothing.
    const photos = await photosOf(owner, galleryId);
    expect((await owner.get(abs(photos[0].previewUrl!))).status()).toBe(200);

    // Run it "as of" day 11 (QA-only clock switch).
    const run = await admin.post(`/api/admin/photo-cleanup/run?galleryId=${galleryId}&asOf=${new Date(now + 11 * 86400000).toISOString()}`);
    expect(run.ok(), await run.text()).toBeTruthy();
    const result = await run.json();
    expect(result.filesDeleted).toBe(10);
    expect(result.galleriesWithFailures).toEqual([]);
    expect((await owner.get(abs(photos[0].previewUrl!))).status(), "preview file is gone").toBe(404);

    // The photos and the customer's selection are kept; only previews are gone.
    const after = await photosOf(owner, galleryId);
    expect(after).toHaveLength(5);
    expect(after.filter((p) => p.selectionType)).toHaveLength(2);
    const relink = await owner.post(`/api/photo-galleries/${galleryId}/link`, { data: { expiresInDays: 5 } });
    expect(relink.status(), "no new link until previews are rebuilt").toBe(400);
    const rebuild = await owner.post(`/api/photo-galleries/${galleryId}/rebuild-previews`);
    expect(rebuild.status(), "device photos: choose the folder again to rebuild").toBe(409);
    expect((await rebuild.json()).code).toBe("CHOOSE_FOLDER_AGAIN");
    // Link periods other than 5/10 days are refused.
    expect((await owner.post(`/api/photo-galleries/${serverGalleryId}/link`, { data: { expiresInDays: 30 } })).status()).toBe(400);
    await admin.dispose();
  });

  it("revoked link: the customer's old link stops working", async () => {
    const link = await owner.post(`/api/photo-galleries/${serverGalleryId}/link`, { data: { expiresInDays: 5 } });
    expect(link.ok()).toBeTruthy();
    const body = await link.json();
    const t = String(body.token ?? body.url ?? body.link ?? JSON.stringify(body)).split("/photo-selection/").pop()!.replace(/"/g, "");
    const pub = await request.newContext({ baseURL: QA.apiUrl });
    expect((await pub.get(`/api/public/photo-selection/${t}`)).status()).toBe(200);
    expect((await owner.delete(`/api/photo-galleries/${serverGalleryId}/link`)).status()).toBe(204);
    const gone = await pub.get(`/api/public/photo-selection/${t}`);
    expect(gone.status()).toBeGreaterThanOrEqual(400);
    expect((await pub.get(`/api/public/photo-selection/not-a-real-token-${tag}`)).status()).toBeGreaterThanOrEqual(400);
    await pub.dispose();
  });
});
