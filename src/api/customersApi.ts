import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { Customer, CreateCustomerRequest, UpdateCustomerRequest } from "../types/customer";

export const customersApi = {
  search: (params: { search?: string; isActive?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Customer>>("/api/customers", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Customer>(`/api/customers/${id}`).then((res) => res.data),

  create: (request: CreateCustomerRequest) =>
    apiClient.post<Customer>("/api/customers", request).then((res) => res.data),

  update: (id: number, request: UpdateCustomerRequest) =>
    apiClient.put<Customer>(`/api/customers/${id}`, request).then((res) => res.data),

  activate: (id: number) => apiClient.post<Customer>(`/api/customers/${id}/activate`).then((res) => res.data),
  deactivate: (id: number) => apiClient.post<Customer>(`/api/customers/${id}/deactivate`).then((res) => res.data),
};
