export const PAYMENT_METHODS = ["Cash", "UPI", "BankTransfer", "Card", "Other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: "Cash",
  UPI: "UPI",
  BankTransfer: "Bank transfer",
  Card: "Card",
  Other: "Other",
};

export const PAYMENT_STATUSES = ["Completed", "Cancelled", "Pending"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Payment {
  paymentId: number;
  customerId: number;
  customerName: string;
  customerMobileNumber: string;
  eventId: number | null;
  eventVenue: string | null;
  eventBudget: number | null;
  eventAmountPaid: number | null;
  eventBalance: number | null;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  customerId: number;
  eventId?: number;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  paymentStatus: PaymentStatus;
}

export type UpdatePaymentRequest = CreatePaymentRequest;
