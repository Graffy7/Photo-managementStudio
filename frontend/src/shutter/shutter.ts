import { useCallback, useRef } from "react";
import { useCameraModeStore } from "./cameraModeStore";
import { playShutterSound } from "./shutterSound";

export const SHUTTER_SIZE = 34;
export const SHUTTER_MS = 240;

// Shortest gap between two shutters, and between two identical capture actions.
const SHUTTER_GAP_MS = 180;
const CAPTURE_GAP_MS = 400;

type ShutterListener = (x: number, y: number) => void;

let listener: ShutterListener | null = null;
let lastFiredAt = 0;

// ShutterProvider registers the one thing that draws the animation.
export function setShutterListener(next: ShutterListener | null): void {
  listener = next;
}

// Shows the shutter animation at a point on screen (page coordinates) and plays the click.
// Does nothing while Camera Mode is off, or if a shutter fired a moment ago.
export function fireShutter(x: number, y: number): void {
  if (!useCameraModeStore.getState().enabled) return;
  const now = Date.now();
  if (now - lastFiredAt < SHUTTER_GAP_MS) return;
  lastFiredAt = now;
  listener?.(x, y);
  playShutterSound();
}

// Wraps a capture action (select a photo, take a shot, ...) so that a rapid double tap doesn't run
// it twice while Camera Mode is on. `keyOf` says which calls count as "the same capture"; calls with
// different keys are never held back. With Camera Mode off the action runs exactly as before.
export function useCapture<A extends unknown[]>(
  action: (...args: A) => void,
  keyOf: (...args: A) => string | number = () => ""
): (...args: A) => void {
  const last = useRef<{ key: string | number; at: number } | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  const keyOfRef = useRef(keyOf);
  keyOfRef.current = keyOf;

  return useCallback((...args: A) => {
    if (useCameraModeStore.getState().enabled) {
      const key = keyOfRef.current(...args);
      const now = Date.now();
      if (last.current && last.current.key === key && now - last.current.at < CAPTURE_GAP_MS) return;
      last.current = { key, at: now };
    }
    actionRef.current(...args);
  }, []);
}
