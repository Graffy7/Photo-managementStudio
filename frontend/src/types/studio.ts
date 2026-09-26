export interface Studio {
  studioId: number;
  studioName: string;
  ownerName: string | null;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  subscriptionPlanId: number | null;
  planName: string | null;
  subscriptionStatus: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;

  // The owner's login account. loginEmail is what they actually type on the login page.
  ownerUserId: number | null;
  loginEmail: string | null;
  ownerIsActive: boolean;
  ownerLastLoginAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateStudioRequest {
  studioName: string;
  phoneNumber?: string;
  address?: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  subscriptionPlanId?: number;
  // Free use between two dates (yyyy-mm-dd, both included) instead of a plan.
  freeTrial?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
}

export interface UpdateStudioRequest {
  studioName: string;
  phoneNumber?: string;
  address?: string;
}
