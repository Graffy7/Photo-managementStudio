import type { AssignedWorker } from "./dayBoard";

// The status follows the event date (Upcoming before the day, Ongoing on it, Completed after);
// only Cancelled is set by hand. "Confirmed" may still come from older data, so it stays a known
// value but isn't offered as a filter.
export const EVENT_STATUSES = ["Upcoming", "Ongoing", "Completed", "Cancelled"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number] | "Confirmed";

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Upcoming: "Upcoming",
  Ongoing: "Ongoing",
  Confirmed: "Confirmed",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

// The status a not-cancelled event has, from its date (yyyy-mm-dd) and today's date.
export function statusForDate(eventDate: string, today: string): EventStatus {
  const day = eventDate.slice(0, 10);
  return day < today ? "Completed" : day === today ? "Ongoing" : "Upcoming";
}

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
  // The crew assigned to this event, sent with the list so it needs no request per row.
  assignedWorkers: AssignedWorker[];
  // The delivery checklist (Album/Video/Photos plus any the studio added), sent for the same reason.
  deliveryItems: DeliveryItem[];
  createdAt: string;
  updatedAt: string;
  // Version stamp of the event as loaded; sent back when saving an edit.
  rowVersion?: string;
}

// One line of a completed event's delivery checklist. itemId is 0 for a standard item that has
// never been ticked - the server writes its row on the first tick.
export interface DeliveryItem {
  itemId: number;
  itemKey: string | null;
  name: string;
  isDelivered: boolean;
  deliveredAt: string | null;
  isCustom: boolean;
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

// rowVersion: the version of the event the form loaded; the server refuses the save (409) if the
// event was changed by someone else since.
export type UpdateEventRequest = CreateEventRequest & { rowVersion?: string };

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
