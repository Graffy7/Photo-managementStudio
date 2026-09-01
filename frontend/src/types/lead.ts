export interface Lead {
  leadId: number;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  eventTypeId: number | null;
  eventTypeName: string | null;
  leadSourceId: number | null;
  leadSourceName: string | null;
  leadStatusId: number | null;
  leadStatusName: string | null;
  expectedEventDate: string | null;
  expectedBudget: number | null;
  location: string | null;
  notes: string | null;
  followUpDate: string | null;
  convertedCustomerId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadRequest {
  fullName: string;
  mobileNumber: string;
  email?: string;
  eventTypeId?: number;
  leadSourceId?: number;
  leadStatusId?: number;
  expectedEventDate?: string;
  expectedBudget?: number;
  location?: string;
  notes?: string;
  followUpDate?: string;
}

export type UpdateLeadRequest = CreateLeadRequest;
