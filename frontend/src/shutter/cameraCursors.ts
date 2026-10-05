// The camera pointers a person can pick from in Camera Mode (web only - touch screens have no
// pointer). Each is drawn on a 32-unit grid; `lens` is the middle of its lens on that grid, which
// becomes the pointer's hotspot; `lensRadius` is how big the lens is, so the shutter can close inside it.

export type CameraCursorId = "normal" | "classic" | "dslr" | "compact" | "instant" | "outline" | "lens";

interface CameraCursor {
  id: CameraCursorId;
  label: string;
  lens: [number, number];
  lensRadius: number;
  body: string;
}

const DARK = "#0b1522";
const LIGHT = "#ffffff";
const ACCENT = "#ff9a4d";
const EDGE = `stroke="${DARK}" stroke-width="1.5" stroke-linejoin="round"`;

export const CAMERA_CURSORS: CameraCursor[] = [
  {
    // The ordinary mouse pointer: no camera, the shutter ring is drawn around the click instead.
    id: "normal",
    label: "Normal",
    lens: [0, 0],
    lensRadius: 0,
    body: `<path d="M9 4v22l6-5.5 4 8.5 3.5-1.7-4-8.3H26z" fill="${LIGHT}" ${EDGE}/>`,
  },
  {
    id: "classic",
    label: "Classic",
    lens: [16, 18],
    lensRadius: 6,
    body:
      `<path d="M4 9h5l2-3h10l2 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="${LIGHT}" ${EDGE}/>` +
      `<circle cx="16" cy="18" r="6" fill="${DARK}"/><circle cx="16" cy="18" r="3" fill="${ACCENT}"/>` +
      `<circle cx="25.5" cy="12.5" r="1.2" fill="${DARK}"/>`,
  },
  {
    id: "dslr",
    label: "DSLR",
    lens: [16, 18.5],
    lensRadius: 6.5,
    body:
      `<path d="M3 10h7l3-5h6l3 5h7a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5v-14A1.5 1.5 0 0 1 3 10z" fill="${DARK}" stroke="${LIGHT}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<rect x="4" y="7.5" width="4" height="2.5" rx="0.5" fill="${LIGHT}"/>` +
      `<circle cx="16" cy="18.5" r="6.5" fill="${LIGHT}"/><circle cx="16" cy="18.5" r="4.5" fill="${DARK}"/>` +
      `<circle cx="16" cy="18.5" r="2" fill="${ACCENT}"/>`,
  },
  {
    id: "compact",
    label: "Compact",
    lens: [13, 17],
    lensRadius: 6,
    body:
      `<rect x="2" y="8" width="28" height="18" rx="4" fill="${ACCENT}" ${EDGE}/>` +
      `<rect x="21" y="11" width="6" height="3.5" rx="1" fill="${LIGHT}" stroke="${DARK}" stroke-width="1"/>` +
      `<rect x="6" y="5.5" width="5" height="2.5" rx="1" fill="${DARK}"/>` +
      `<circle cx="13" cy="17" r="6" fill="${LIGHT}" stroke="${DARK}" stroke-width="1.5"/><circle cx="13" cy="17" r="2.8" fill="${DARK}"/>`,
  },
  {
    id: "instant",
    label: "Instant",
    lens: [16, 14],
    lensRadius: 5.5,
    body:
      `<rect x="4" y="3" width="24" height="26" rx="3" fill="${LIGHT}" ${EDGE}/>` +
      `<rect x="4" y="21" width="24" height="3" fill="${ACCENT}"/>` +
      `<rect x="9" y="25.5" width="14" height="1.5" rx="0.7" fill="${DARK}"/>` +
      `<rect x="21.5" y="5.5" width="4" height="3" rx="0.8" fill="${DARK}"/>` +
      `<circle cx="16" cy="14" r="5.5" fill="${DARK}"/><circle cx="16" cy="14" r="2.5" fill="${ACCENT}"/>`,
  },
  {
    id: "outline",
    label: "Outline",
    lens: [16, 18],
    lensRadius: 6,
    body:
      `<path d="M4 9h5l2-3h10l2 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="none" stroke="${DARK}" stroke-width="4.5" stroke-linejoin="round"/>` +
      `<path d="M4 9h5l2-3h10l2 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="none" stroke="${LIGHT}" stroke-width="2" stroke-linejoin="round"/>` +
      `<circle cx="16" cy="18" r="5" fill="none" stroke="${DARK}" stroke-width="4.5"/>` +
      `<circle cx="16" cy="18" r="5" fill="none" stroke="${LIGHT}" stroke-width="2"/>`,
  },
  {
    id: "lens",
    label: "Lens",
    lens: [16, 16],
    lensRadius: 8.5,
    body:
      `<circle cx="16" cy="16" r="13" fill="${DARK}" stroke="${LIGHT}" stroke-width="2"/>` +
      `<circle cx="16" cy="16" r="8.5" fill="none" stroke="${LIGHT}" stroke-width="1.5"/>` +
      `<circle cx="16" cy="16" r="4" fill="${ACCENT}"/><circle cx="13" cy="12.5" r="1.5" fill="${LIGHT}"/>`,
  },
];

export const DEFAULT_CAMERA_CURSOR: CameraCursorId = "classic";

// Size of the pointer on screen, in pixels.
export const CAMERA_CURSOR_SIZE = 22;

function find(id: CameraCursorId): CameraCursor {
  return CAMERA_CURSORS.find((c) => c.id === id) ?? CAMERA_CURSORS[0];
}

export function isCameraCursorId(value: string | null): value is CameraCursorId {
  return CAMERA_CURSORS.some((c) => c.id === value);
}

// How far the shutter is closed in each frame of the click animation: 0 is open, 1 is shut,
// "flash" is the bright blink of the exposure. The frames play inside the camera's own lens.
export type ShutterFrame = number | "flash";
export const SHUTTER_FRAMES: ShutterFrame[] = [0.5, 1, "flash", 0.5];

function shutterOverlay(camera: CameraCursor, frame: ShutterFrame): string {
  const [cx, cy] = camera.lens;
  const r = camera.lensRadius;
  const at = `cx="${cx}" cy="${cy}"`;
  if (frame === "flash") return `<circle ${at} r="${r}" fill="${LIGHT}" stroke="${DARK}" stroke-width="1"/>`;
  const opening = r * (1 - frame) * 0.8;
  return (
    `<circle ${at} r="${r}" fill="${DARK}" stroke="${LIGHT}" stroke-width="1"/>` +
    (opening > 0 ? `<circle ${at} r="${opening}" fill="${LIGHT}"/>` : "")
  );
}

// The camera as an image address (used both for the pointer and for the picker's previews).
// With `frame`, the lens is drawn part-way through the shutter animation.
export function cameraImageUri(id: CameraCursorId, size: number, frame?: ShutterFrame): string {
  const camera = find(id);
  const overlay = frame === undefined ? "" : shutterOverlay(camera, frame);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${camera.body}${overlay}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// The CSS `cursor` value for a camera, or null for the normal pointer (nothing to override).
export function cameraCursorCss(id: CameraCursorId, frame?: ShutterFrame): string | null {
  if (id === "normal") return null;
  const [x, y] = find(id).lens;
  const scale = CAMERA_CURSOR_SIZE / 32;
  return `url("${cameraImageUri(id, CAMERA_CURSOR_SIZE, frame)}") ${Math.round(x * scale)} ${Math.round(y * scale)}, crosshair`;
}
