// Worked out by the server: converted into a customer; otherwise "event over" once the expected
// event date has passed, else still "not converted".
export type LeadOutcome = "Converted" | "NotConverted" | "EventOver";

export const LEAD_OUTCOMES: LeadOutcome[] = ["Converted", "NotConverted", "EventOver"];

export const LEAD_OUTCOME_LABELS: Record<LeadOutcome, string> = {
  Converted: "Converted",
  NotConverted: "Not converted",
  EventOver: "Event over",
};

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
  outcome: LeadOutcome;
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
