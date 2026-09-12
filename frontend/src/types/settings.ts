export interface StudioProfile {
  studioId: number;
  studioName: string;
  ownerName: string | null;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  website: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  subscriptionPlanId: number | null;
  planName: string | null;
  subscriptionStatus: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
}

export interface UpdateStudioProfileRequest {
  studioName: string;
  ownerName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  website?: string;
}

export interface BusinessSettings {
  quotationValidityDays: number;
  currency: string;
  taxPercentage: number;
  paymentTerms: string;
  advancePaymentPercentage: number;
  dateFormat: string;
  timeFormat: string;
}

export interface NotificationSettings {
  eventReminder: boolean;
  paymentReminder: boolean;
  workerEventNotification: boolean;
  quotationNotification: boolean;
  whatsAppNotification: boolean;
}

export interface QuotationSettings {
  prefix: string;
  startingNumber: number;
  defaultTerms: string;
  defaultNotes: string;
  showGst: boolean;
  showAddress: boolean;
  showContact: boolean;
  showLogo: boolean;
}
