import { apiClient } from "./client";
import type { SubscriptionPlan } from "../types/subscription";

export const subscriptionPlansApi = {
  getActive: () => apiClient.get<SubscriptionPlan[]>("/api/subscription-plans").then((res) => res.data),
};
