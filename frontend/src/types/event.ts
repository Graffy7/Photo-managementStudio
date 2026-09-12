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
  eventStatus: EventStatus;
  fileLocation?: string;
  notes?: string;
}

export type UpdateEventRequest = CreateEventRequest;
