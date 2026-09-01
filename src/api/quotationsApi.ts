import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateQuotationRequest, Quotation, UpdateQuotationRequest } from "../types/quotation";

export const quotationsApi = {
  search: (params: { search?: string; status?: string; customerId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Quotation>>("/api/quotations", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Quotation>(`/api/quotations/${id}`).then((res) => res.data),

  create: (request: CreateQuotationRequest) =>
    apiClient.post<Quotation>("/api/quotations", request).then((res) => res.data),

  update: (id: number, request: UpdateQuotationRequest) =>
    apiClient.put<Quotation>(`/api/quotations/${id}`, request).then((res) => res.data),

  downloadPdf: (id: number) =>
    apiClient.get<ArrayBuffer>(`/api/quotations/${id}/pdf`, { responseType: "arraybuffer" }).then((res) => res.data),
};
