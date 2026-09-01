import { apiClient } from "./client";
import type { CreateExpenseCategoryRequest, ExpenseCategory, UpdateExpenseCategoryRequest } from "../types/expenseCategory";

export const expenseCategoriesApi = {
  getAll: () => apiClient.get<ExpenseCategory[]>("/api/expense-categories").then((res) => res.data),

  create: (request: CreateExpenseCategoryRequest) =>
    apiClient.post<ExpenseCategory>("/api/expense-categories", request).then((res) => res.data),

  update: (id: number, request: UpdateExpenseCategoryRequest) =>
    apiClient.put<ExpenseCategory>(`/api/expense-categories/${id}`, request).then((res) => res.data),

  activate: (id: number) => apiClient.post<ExpenseCategory>(`/api/expense-categories/${id}/activate`).then((res) => res.data),
  deactivate: (id: number) => apiClient.post<ExpenseCategory>(`/api/expense-categories/${id}/deactivate`).then((res) => res.data),
};
