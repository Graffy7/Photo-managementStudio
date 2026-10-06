import { Platform } from "react-native";
import { create } from "zustand";

// Camera Cursor Mode: a purely visual extra for the web app. The choice is remembered on this
// browser only; it never touches the server.
const STORAGE_KEY = "studio_os_camera_cursor";

function readSaved(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false; // private window / storage blocked: simply start switched off
  }
}

interface CameraCursorState {
  enabled: boolean;
  toggle: () => void;
}

export const useCameraCursor = create<CameraCursorState>((set, get) => ({
  enabled: readSaved(),
  toggle: () => {
    const enabled = !get().enabled;
    set({ enabled });
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // not remembered next time; the mode still works for this visit
    }
  },
}));
