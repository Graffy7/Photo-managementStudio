import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreatePaymentRequest, Payment, UpdatePaymentRequest } from "../types/payment";

export const paymentsApi = {
  search: (params: { search?: string; paymentStatus?: string; customerId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Payment>>("/api/payments", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Payment>(`/api/payments/${id}`).then((res) => res.data),

  create: (request: CreatePaymentRequest) =>
    apiClient.post<Payment>("/api/payments", request).then((res) => res.data),

  update: (id: number, request: UpdatePaymentRequest) =>
    apiClient.put<Payment>(`/api/payments/${id}`, request).then((res) => res.data),
};
