import { apiClient } from "./client";
import type { Checkout, SubscriptionStatus } from "../types/billing";

export const billingApi = {
  status: () => apiClient.get<SubscriptionStatus>("/api/subscription").then((r) => r.data),

  checkout: (planId: number) => apiClient.post<Checkout>("/api/subscription/checkout", { planId }).then((r) => r.data),

  // Sends the gateway's success callback for the server to verify; returns the updated status.
  verify: (body: { orderId: string; paymentId: string; signature: string }) =>
    apiClient.post<SubscriptionStatus>("/api/subscription/verify", body).then((r) => r.data),

  failed: (orderId: string, reason?: string) =>
    apiClient.post("/api/subscription/failed", { orderId, reason }).then(() => undefined),
};
