import { create } from "zustand";
import { authApi } from "../api/authApi";
import { tokenStorage } from "./tokenStorage";
import { setOnAuthFailure } from "../api/client";
import { extractErrorMessage } from "../api/errorMessage";
import type { UserProfile } from "../types/auth";

interface AuthState {
  user: UserProfile | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  forceLogout: () => void;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrating: true,
  isSubmitting: false,
  error: null,

  hydrate: async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) {
      set({ isHydrating: false });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, isHydrating: false });
    } catch {
      await tokenStorage.clear();
      set({ user: null, isHydrating: false });
    }
  },

  login: async (email, password, rememberMe) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await authApi.login({ email, password, rememberMe });
      await tokenStorage.setTokens(response.accessToken, response.refreshToken);
      set({ user: response.user, isSubmitting: false });
      return true;
    } catch (err) {
      set({ isSubmitting: false, error: extractErrorMessage(err, "Unable to sign in. Please try again.") });
      return false;
    }
  },

  logout: async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Best-effort — even if the revoke call fails, clear the local session below.
      }
    }
    await tokenStorage.clear();
    set({ user: null });
  },

  forceLogout: () => {
    set({ user: null });
  },

  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      await tokenStorage.clear();
      set({ user: null });
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err) };
    }
  },
}));

setOnAuthFailure(() => useAuthStore.getState().forceLogout());
