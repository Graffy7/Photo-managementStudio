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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
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
