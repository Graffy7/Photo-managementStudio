export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Cancelled"] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface QuotationItem {
  quotationItemId: number;
  serviceId: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string | null;
}

export interface Quotation {
  quotationId: number;
  quotationNumber: string;
  customerId: number;
  customerName: string;
  customerMobileNumber: string;
  eventId: number | null;
  eventVenue: string | null;
  quotationDate: string;
  validUntil: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
  status: QuotationStatus;
  termsAndConditions: string | null;
  items: QuotationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItemRequest {
  serviceId: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface CreateQuotationRequest {
  customerId: number;
  eventId?: number;
  quotationDate: string;
  validUntil?: string;
  discount: number;
  taxAmount: number;
  status: QuotationStatus;
  termsAndConditions?: string;
  items: QuotationItemRequest[];
}

export type UpdateQuotationRequest = CreateQuotationRequest;
