export interface Customer {
  customerId: number;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  fullName: string;
  mobileNumber: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type UpdateCustomerRequest = CreateCustomerRequest;

export interface CustomerEventSummary {
  eventId: number;
  eventTypeName: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  eventStatus: string;
  budget: number | null;
  amountPaid: number;
  balance: number;
  workerCount: number;
  notes: string | null;
}
