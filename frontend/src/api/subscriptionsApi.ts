import { apiClient } from "./client";
import type { Studio } from "../types/studio";
import type { RenewSubscriptionRequest, SubscriptionPayment } from "../types/subscription";

export const subscriptionsApi = {
  renew: (studioId: number, request: RenewSubscriptionRequest) =>
    apiClient.post<Studio>(`/api/studios/${studioId}/subscription/renew`, request).then((res) => res.data),

  getPaymentHistory: (studioId: number) =>
    apiClient.get<SubscriptionPayment[]>(`/api/studios/${studioId}/subscription/payments`).then((res) => res.data),
};
