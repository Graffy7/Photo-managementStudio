import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateExpenseRequest, Expense, UpdateExpenseRequest } from "../types/expense";

export const expensesApi = {
  search: (params: { search?: string; expenseCategoryId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Expense>>("/api/expenses", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Expense>(`/api/expenses/${id}`).then((res) => res.data),

  create: (request: CreateExpenseRequest) => apiClient.post<Expense>("/api/expenses", request).then((res) => res.data),

  update: (id: number, request: UpdateExpenseRequest) =>
    apiClient.put<Expense>(`/api/expenses/${id}`, request).then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/api/expenses/${id}`),
};
