import axios from "axios";
import { API_BASE_URL } from "../constants/config";
import { tokenStorage } from "../auth/tokenStorage";
import type { LoginResponse } from "../types/auth";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Plain client with no interceptors — used only for the refresh call itself, so a failed
// refresh can never recursively trigger another refresh attempt.
const rawClient = axios.create({ baseURL: API_BASE_URL });

let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(callback: () => void): void {
  onAuthFailure = callback;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await rawClient.post<LoginResponse>("/api/auth/refresh", { refreshToken });
    await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

// Called when the server says the studio's subscription has run out (HTTP 402), so the app can
// switch to the renewal page straight away instead of showing broken screens.
let onSubscriptionExpired: (() => void) | null = null;
export function setOnSubscriptionExpired(callback: (() => void) | null) {
  onSubscriptionExpired = callback;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const code = error.response?.data?.code;
    if (code === "SUBSCRIPTION_READ_ONLY" || code === "STUDIO_SUSPENDED") {
      onSubscriptionExpired?.();
    }

    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.startsWith("/api/auth/");

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newAccessToken = await refreshInFlight;

      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }

      await tokenStorage.clear();
      onAuthFailure?.();
    }

    return Promise.reject(error);
  }
);
