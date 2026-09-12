import axios from "axios";
import { API_BASE_URL } from "../constants/config";
import type { PublicPhoto, PublicProjectSummary, SubmitResult } from "../types/photoSelection";

// Its own axios instance with no auth interceptors at all — a studio owner's cached JWT must
// never attach to a public customer request (and vice versa). The PIN, when a project requires
// one, travels as a custom header on every call rather than a cookie/session, since the whole
// flow is intentionally stateless: the token in the URL plus this PIN *are* the authorization.
const publicClient = axios.create({ baseURL: API_BASE_URL });

let currentPin: string | null = null;
export function setPhotoSelectionPin(pin: string | null): void {
  currentPin = pin;
}

publicClient.interceptors.request.use((config) => {
  if (currentPin) {
    config.headers["X-Selection-Pin"] = currentPin;
  }
  return config;
});

export const publicPhotoSelectionApi = {
  unlock: (token: string, pin: string) =>
    publicClient.post<{ message: string }>(`/api/public/photo-selection/${token}/unlock`, { pin }).then((res) => res.data),

  getSummary: (token: string) =>
    publicClient.get<PublicProjectSummary>(`/api/public/photo-selection/${token}`).then((res) => res.data),

  getPhotos: (token: string, cursor?: number, limit = 50) =>
    publicClient
      .get<PublicPhoto[]>(`/api/public/photo-selection/${token}/photos`, { params: { cursor, limit } })
      .then((res) => res.data),

  setSelection: (token: string, photoId: number, selectionType: string) =>
    publicClient
      .put<PublicPhoto>(`/api/public/photo-selection/${token}/photos/${photoId}/selection`, { selectionType })
      .then((res) => res.data),

  submit: (token: string) =>
    publicClient.post<SubmitResult>(`/api/public/photo-selection/${token}/submit`).then((res) => res.data),
};
