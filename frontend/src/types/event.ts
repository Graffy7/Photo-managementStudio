export const EVENT_STATUSES = ["Upcoming", "Confirmed", "Completed", "Cancelled"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Upcoming: "Upcoming",
  Confirmed: "Confirmed",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export interface StudioEvent {
  eventId: number;
  customerId: number;
  customerName: string;
  customerMobileNumber: string;
  eventTypeId: number | null;
  eventTypeName: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  budget: number | null;
  amountPaid: number;
  balance: number;
  eventStatus: EventStatus;
  fileLocation: string | null;
  notes: string | null;
  // Stamped the first time the event is marked Completed; null for events completed before this
  // was recorded.
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  customerId: number;
  eventTypeId?: number;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  venueAddress?: string;
  budget?: number;
  // Only honoured when creating: recorded as a Completed payment against the new event.
  advancePaid?: number;
  advancePaymentMethod?: string;
  eventStatus: EventStatus;
  fileLocation?: string;
  notes?: string;
}

export type UpdateEventRequest = CreateEventRequest;

// ---- Event history: the permanent record of one event ----

export interface EventHistoryQuotation {
  quotationId: number;
  // "V1", "V2", ... in the order they were raised for this event.
  version: string;
  quotationNumber: string;
  quotationDate: string;
  status: string;
  grandTotal: number;
  isApproved: boolean;
}

export interface EventHistoryPayment {
  paymentId: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  referenceNumber: string | null;
  notes: string | null;
}

export interface EventHistoryWorker {
  workerId: number;
  workerName: string;
  workerTypeName: string | null;
  role: string | null;
}

export interface EventHistory {
  event: StudioEvent;
  workers: EventHistoryWorker[];
  quotations: EventHistoryQuotation[];
  approvedQuotation: EventHistoryQuotation | null;
  payments: EventHistoryPayment[];
  finalAmount: number | null;
}
