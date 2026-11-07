import { playFocusSound } from "./shutterSound";

// Camera autofocus effect for the web. When the mouse rests in one place the screen behaves like a
// lens finding its subject: the picture goes soft and "hunts" for a moment, a focus frame closes in
// on the pointer, then it locks - the frame turns green, the camera beeps, and everything away from
// the pointer stays out of focus, more so the further away it is. It clears the moment the mouse
// moves, clicks, scrolls or a key is pressed. The layer never takes clicks.

const REST_MS = 1200; // how long the mouse must stay still
const MOVE_TOLERANCE = 4; // pixels of jitter that still count as "still"
const HUNT_MS = 520; // the lens searching before it locks
const FADE_MS = 220;

// Depth of field: each ring adds blur on top of the one inside it, so sharpness falls off gradually.
const BLUR_RINGS = [
  { blur: 1.2, radius: 210 },
  { blur: 2.2, radius: 430 },
  { blur: 3.2, radius: 760 },
];
const HUNT_BLUR_PX = 6;
const FRAME_SIZE = 84;
const FRAME_SEARCHING = "rgba(255,255,255,0.95)";
const FRAME_LOCKED = "#35e06f";

function el(css: string): HTMLDivElement {
  const node = document.createElement("div");
  node.style.cssText = css;
  return node;
}

function blurCss(px: number): string {
  return `backdrop-filter:blur(${px}px);-webkit-backdrop-filter:blur(${px}px);`;
}

// Starts watching the mouse; returns a function that stops and removes the effect.
export function startFocusBlur(): () => void {
  if (typeof document === "undefined") return () => {};

  const fill = "position:absolute;inset:0;";
  // The fade is applied to each layer, not to this wrapper: a wrapper with its own opacity would cut
  // the blur layers off from the page behind them and they would blur nothing.
  const root = el("position:fixed;inset:0;pointer-events:none;z-index:2147483646;");
  const fade = `opacity:0;transition:opacity ${FADE_MS}ms ease-out;`;
  root.setAttribute("aria-hidden", "true");

  const rings = BLUR_RINGS.map((ring) => el(fill + fade + blurCss(ring.blur)));
  // Edges fall slightly darker, as they do through a real lens.
  const vignette = el(fill + fade);
  const steady = [...rings, vignette];
  // The whole picture going soft while the lens searches.
  const hunt = el(fill + blurCss(HUNT_BLUR_PX) + "opacity:0;");

  // Focus frame: four corner brackets around the pointer.
  const frame = el(`position:absolute;width:${FRAME_SIZE}px;height:${FRAME_SIZE}px;color:${FRAME_SEARCHING};opacity:0;`);
  const corner = "position:absolute;width:16px;height:16px;border:0 solid currentColor;filter:drop-shadow(0 0 1px rgba(0,0,0,0.8));";
  frame.append(
    el(corner + "left:0;top:0;border-left-width:2px;border-top-width:2px;"),
    el(corner + "right:0;top:0;border-right-width:2px;border-top-width:2px;"),
    el(corner + "left:0;bottom:0;border-left-width:2px;border-bottom-width:2px;"),
    el(corner + "right:0;bottom:0;border-right-width:2px;border-bottom-width:2px;"),
    el("position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:currentColor;")
  );

  root.append(...rings, vignette, hunt, frame);
  document.body.appendChild(root);

  let restTimer: ReturnType<typeof setTimeout> | undefined;
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  let animations: Animation[] = [];
  let rest: { x: number; y: number } | null = null;
  let shown = false;

  const focusAt = (x: number, y: number) => {
    rings.forEach((node, i) => {
      const mask = `radial-gradient(circle ${BLUR_RINGS[i].radius}px at ${x}px ${y}px, transparent 0, transparent 45%, #000 100%)`;
      node.style.setProperty("mask-image", mask);
      node.style.setProperty("-webkit-mask-image", mask);
    });
    vignette.style.background = `radial-gradient(circle 900px at ${x}px ${y}px, transparent 0, transparent 35%, rgba(0,0,0,0.3) 100%)`;
    frame.style.left = `${x - FRAME_SIZE / 2}px`;
    frame.style.top = `${y - FRAME_SIZE / 2}px`;
    frame.style.color = FRAME_SEARCHING;
    steady.forEach((node) => (node.style.opacity = "1"));
    shown = true;

    // Hunting: the picture swings soft, nearly sharp, soft again, then snaps into focus.
    animations = [
      hunt.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.25, offset: 0.55 }, { opacity: 0.7, offset: 0.78 }, { opacity: 0 }],
        { duration: HUNT_MS, easing: "ease-in-out" }
      ),
      frame.animate(
        [
          { opacity: 0, transform: "scale(1.7)" },
          { opacity: 1, transform: "scale(1.15)", offset: 0.3 },
          { opacity: 1, transform: "scale(1.3)", offset: 0.55 },
          { opacity: 1, transform: "scale(0.94)", offset: 0.85 },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: HUNT_MS, easing: "ease-out", fill: "forwards" }
      ),
    ];

    lockTimer = setTimeout(() => {
      frame.style.color = FRAME_LOCKED;
      playFocusSound();
      // Once locked the frame steps back so it isn't in the way of what is being looked at.
      animations.push(frame.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 500, delay: 700, fill: "forwards" }));
    }, HUNT_MS);
  };

  const clear = () => {
    clearTimeout(restTimer);
    clearTimeout(lockTimer);
    if (!shown) return;
    animations.forEach((a) => a.cancel());
    animations = [];
    steady.forEach((node) => (node.style.opacity = "0"));
    shown = false;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (rest && Math.abs(e.clientX - rest.x) <= MOVE_TOLERANCE && Math.abs(e.clientY - rest.y) <= MOVE_TOLERANCE) return;
    clear();
    const point = { x: e.clientX, y: e.clientY };
    rest = point;
    restTimer = setTimeout(() => focusAt(point.x, point.y), REST_MS);
  };

  // Anything else the person does ends the effect; it comes back only after the mouse moves and rests again.
  const onInterrupt = () => {
    clear();
    rest = null;
  };

  document.addEventListener("pointermove", onMove, true);
  const interrupts = ["pointerdown", "wheel", "scroll", "keydown"] as const;
  interrupts.forEach((name) => document.addEventListener(name, onInterrupt, true));
  document.documentElement.addEventListener("mouseleave", onInterrupt);

  return () => {
    clear();
    document.removeEventListener("pointermove", onMove, true);
    interrupts.forEach((name) => document.removeEventListener(name, onInterrupt, true));
    document.documentElement.removeEventListener("mouseleave", onInterrupt);
    root.remove();
  };
}
