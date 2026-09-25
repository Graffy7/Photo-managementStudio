import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateQuotationRequest, PriceDisplay, Quotation, QuotationStatus, UpdateQuotationRequest } from "../types/quotation";

export const quotationsApi = {
  search: (params: { search?: string; status?: string; customerId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Quotation>>("/api/quotations", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Quotation>(`/api/quotations/${id}`).then((res) => res.data),

  create: (request: CreateQuotationRequest) =>
    apiClient.post<Quotation>("/api/quotations", request).then((res) => res.data),

  update: (id: number, request: UpdateQuotationRequest) =>
    apiClient.put<Quotation>(`/api/quotations/${id}`, request).then((res) => res.data),

  setStatus: (id: number, status: QuotationStatus) =>
    apiClient.post<Quotation>(`/api/quotations/${id}/status`, { status }).then((res) => res.data),

  // priceDisplay prints this copy that way; without it the quotation's saved choice is used.
  downloadPdf: (id: number, priceDisplay?: PriceDisplay) =>
    apiClient
      .get<ArrayBuffer>(`/api/quotations/${id}/pdf`, { responseType: "arraybuffer", params: priceDisplay ? { priceDisplay } : undefined })
      .then((res) => res.data),

  // Saves how this quotation's PDF shows prices (only this quotation).
  setPriceDisplay: (id: number, priceDisplay: PriceDisplay) =>
    apiClient.put<Quotation>(`/api/quotations/${id}/price-display`, { priceDisplay }).then((res) => res.data),
};
