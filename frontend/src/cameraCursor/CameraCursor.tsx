import { useEffect } from "react";
import { Platform } from "react-native";
import { useCameraCursor } from "./cameraCursorStore";
import { playShutter } from "./shutterSound";

// Camera Cursor Mode (web only). While it's on, the mouse pointer is drawn as a small camera whose
// lens centre is the click point; every click plays a shutter sound, closes and reopens the lens, and
// draws a quick viewfinder "capture" at the exact spot. It only listens - clicks are never stopped
// or changed, so the app behaves exactly as with the normal pointer. Switching it off removes
// everything it added.
const STYLE_ID = "camera-cursor-style";
const ROOT_CLASS = "camera-cursor-on";
const LENS_X = 18; // lens centre inside the 36x30 drawing = the click point
const LENS_Y = 17.5;
// On-screen size of the camera relative to its 36x30 drawing.
const SCALE = 0.72;
const WIDTH = 36 * SCALE;
const HEIGHT = 30 * SCALE;
const HOT_X = LENS_X * SCALE; // where the lens centre lands on screen
const HOT_Y = LENS_Y * SCALE;

const CSS = `
html.${ROOT_CLASS}, html.${ROOT_CLASS} * { cursor: none !important; }
.cc-pointer { position: fixed; left: 0; top: 0; width: ${WIDTH}px; height: ${HEIGHT}px; margin: -${HOT_Y}px 0 0 -${HOT_X}px;
  pointer-events: none; z-index: 2147483647; opacity: 0; transition: opacity 120ms ease; will-change: transform; }
.cc-pointer.cc-visible { opacity: 1; }
.cc-pointer svg { display: block; overflow: visible; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.55)); transform-origin: ${HOT_X}px ${HOT_Y}px; }
.cc-glass { transform-origin: ${LENS_X}px ${LENS_Y}px; }
.cc-pointer.cc-shoot svg { animation: cc-press 240ms cubic-bezier(.2,.8,.2,1); }
.cc-pointer.cc-shoot .cc-glass { animation: cc-iris 240ms cubic-bezier(.4,0,.2,1); }
.cc-pointer.cc-shoot .cc-button { animation: cc-button 240ms ease-out; }
@keyframes cc-press { 0% { transform: scale(1); } 35% { transform: scale(0.9); } 100% { transform: scale(1); } }
@keyframes cc-iris { 0% { transform: scale(1); } 40% { transform: scale(0.08); } 55% { transform: scale(0.08); } 100% { transform: scale(1); } }
@keyframes cc-button { 0% { transform: translateY(0); } 35% { transform: translateY(1.5px); } 100% { transform: translateY(0); } }
.cc-capture { position: fixed; width: 42px; height: 42px; margin: -21px 0 0 -21px; pointer-events: none; z-index: 2147483646;
  animation: cc-frame 320ms cubic-bezier(.2,.8,.2,1) forwards; }
.cc-capture i { position: absolute; width: 10px; height: 10px; border: 2px solid #ff9a4d; box-shadow: 0 0 0 1px rgba(11,21,34,0.55); }
.cc-capture i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 3px; }
.cc-capture i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 3px; }
.cc-capture i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 3px; }
.cc-capture i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 3px; }
.cc-capture b { position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
  border: 1.5px solid rgba(232,237,243,0.9); animation: cc-ring 320ms ease-out forwards; }
@keyframes cc-frame { 0% { transform: scale(1.25); opacity: 0; } 25% { opacity: 1; } 60% { transform: scale(0.72); opacity: 1; } 100% { transform: scale(0.72); opacity: 0; } }
@keyframes cc-ring { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(1.15); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .cc-pointer.cc-shoot svg, .cc-pointer.cc-shoot .cc-button { animation: none; }
  .cc-capture, .cc-capture b { animation-duration: 160ms; }
}
`;

const CAMERA_SVG = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 36 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect class="cc-button" x="24.5" y="2.5" width="6" height="4" rx="1.4" fill="#ff9a4d" stroke="#0b1522" stroke-width="1"/>
  <path d="M11.5 6.5 13.4 3.3a1.6 1.6 0 0 1 1.4-.8h6.4a1.6 1.6 0 0 1 1.4.8l1.9 3.2z" fill="#f4f7fb" stroke="#0b1522" stroke-width="1.2" stroke-linejoin="round"/>
  <rect x="1.6" y="6.2" width="32.8" height="22.2" rx="5" fill="#f4f7fb" stroke="#0b1522" stroke-width="1.2"/>
  <rect x="4.6" y="9.2" width="5" height="2.6" rx="1.3" fill="#9fb0c5"/>
  <circle cx="${LENS_X}" cy="${LENS_Y}" r="8.2" fill="#0b1522"/>
  <circle cx="${LENS_X}" cy="${LENS_Y}" r="6.6" fill="#101d2e" stroke="#9fb0c5" stroke-width="0.8"/>
  <g class="cc-glass">
    <circle cx="${LENS_X}" cy="${LENS_Y}" r="5.2" fill="#2f6f9e"/>
    <circle cx="${LENS_X}" cy="${LENS_Y}" r="3" fill="#143a57"/>
    <circle cx="${LENS_X - 1.7}" cy="${LENS_Y - 1.8}" r="1.1" fill="rgba(255,255,255,0.75)"/>
  </g>
  <circle cx="${LENS_X}" cy="${LENS_Y}" r="0.9" fill="#ff9a4d"/>
</svg>`;

export function CameraCursor() {
  const enabled = useCameraCursor((s) => s.enabled);

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled || typeof document === "undefined") return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);

    const pointer = document.createElement("div");
    pointer.className = "cc-pointer";
    pointer.innerHTML = CAMERA_SVG;
    document.body.appendChild(pointer);

    // The camera replaces the pointer only where there is one (mouse / pen); a finger has no pointer
    // to replace, so on touch screens only the capture effect and sound are used.
    const root = document.documentElement;
    let x = -100, y = -100, frame = 0, usingMouse = false;

    const place = () => {
      frame = 0;
      pointer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const setMouse = (on: boolean) => {
      if (on === usingMouse) return;
      usingMouse = on;
      root.classList.toggle(ROOT_CLASS, on);
      pointer.classList.toggle("cc-visible", on);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return setMouse(false);
      x = e.clientX;
      y = e.clientY;
      setMouse(true);
      // One position update per screen frame: follows the mouse exactly, without flooding layout.
      if (!frame) frame = requestAnimationFrame(place);
    };
    const onLeave = () => pointer.classList.remove("cc-visible");
    const onEnter = () => { if (usingMouse) pointer.classList.add("cc-visible"); };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // left click only
      playShutter();
      // restart the lens animation even on rapid clicks
      pointer.classList.remove("cc-shoot");
      void pointer.offsetWidth;
      pointer.classList.add("cc-shoot");

      const capture = document.createElement("div");
      capture.className = "cc-capture";
      capture.style.left = `${e.clientX}px`;
      capture.style.top = `${e.clientY}px`;
      capture.innerHTML = "<i></i><i></i><i></i><i></i><b></b>";
      document.body.appendChild(capture);
      window.setTimeout(() => capture.remove(), 400);
    };

    // Capture phase + passive: seen before the app handles the event, and never able to block it.
    const listen = { capture: true, passive: true } as const;
    window.addEventListener("pointermove", onMove, listen);
    window.addEventListener("pointerdown", onDown, listen);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("mouseenter", onEnter);

    return () => {
      window.removeEventListener("pointermove", onMove, listen);
      window.removeEventListener("pointerdown", onDown, listen);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("mouseenter", onEnter);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove(ROOT_CLASS);
      pointer.remove();
      style.remove();
      document.querySelectorAll(".cc-capture").forEach((el) => el.remove());
    };
  }, [enabled]);

  return null;
}
