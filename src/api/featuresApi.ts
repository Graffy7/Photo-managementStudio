import { apiClient } from "./client";
import type { StudioFeature } from "../types/feature";

export const featuresApi = {
  getForStudio: (studioId: number) =>
    apiClient.get<StudioFeature[]>(`/api/studios/${studioId}/features`).then((res) => res.data),

  enable: (studioId: number, featureCode: string) =>
    apiClient.post<StudioFeature>(`/api/studios/${studioId}/features/${featureCode}/enable`).then((res) => res.data),

  disable: (studioId: number, featureCode: string) =>
    apiClient.post<StudioFeature>(`/api/studios/${studioId}/features/${featureCode}/disable`).then((res) => res.data),

  getMyFeatures: () =>
    apiClient.get<Record<string, boolean>>("/api/features/my-features").then((res) => res.data),
};
