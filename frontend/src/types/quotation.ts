export type PriceDisplay = "Detailed" | "TotalOnly";

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Cancelled"] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface QuotationItem {
  quotationItemId: number;
  serviceId: number | null;
  // The catalog service's name, or the typed name of a custom line.
  serviceName: string;
  isCustom: boolean;
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
  // How this quotation's PDF shows prices (this quotation only).
  priceDisplay: PriceDisplay;
  // Typed total of a Total-only quotation; when set it is the grand total.
  manualTotal: number | null;
  items: QuotationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItemRequest {
  // A catalog service, or leave it out and give customName for a custom line.
  serviceId?: number;
  customName?: string;
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
  priceDisplay?: PriceDisplay;
  manualTotal?: number;
  items: QuotationItemRequest[];
}

export type UpdateQuotationRequest = CreateQuotationRequest;
