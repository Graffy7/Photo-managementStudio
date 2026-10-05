import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CAMERA_CURSOR, isCameraCursorId, type CameraCursorId } from "./cameraCursors";

const CAMERA_MODE_KEY = "studio_os_camera_mode";
const CAMERA_CURSOR_KEY = "studio_os_camera_cursor";

interface CameraModeState {
  enabled: boolean;
  cursor: CameraCursorId;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setCursor: (cursor: CameraCursorId) => void;
}

// Camera Mode is a per-device preference (like a ringer switch), so it lives in local storage
// rather than on the server: no API or database involved, and it works on the customer's
// login-free photo-selection page too. Off until the person turns it on.
export const useCameraModeStore = create<CameraModeState>((set) => ({
  enabled: false,
  cursor: DEFAULT_CAMERA_CURSOR,

  hydrate: async () => {
    try {
      const [enabled, cursor] = await Promise.all([AsyncStorage.getItem(CAMERA_MODE_KEY), AsyncStorage.getItem(CAMERA_CURSOR_KEY)]);
      set({ enabled: enabled === "1", cursor: isCameraCursorId(cursor) ? cursor : DEFAULT_CAMERA_CURSOR });
    } catch {
      // Storage unavailable (private browsing etc.) - stay off.
    }
  },

  setEnabled: (enabled) => {
    set({ enabled });
    AsyncStorage.setItem(CAMERA_MODE_KEY, enabled ? "1" : "0").catch(() => {});
  },

  setCursor: (cursor) => {
    set({ cursor });
    AsyncStorage.setItem(CAMERA_CURSOR_KEY, cursor).catch(() => {});
  },
}));
