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

export type PdfTemplate = "Classic" | "Modern" | "Minimal" | "Elegant";
export type PdfHeaderStyle = "Standard" | "Banner" | "Centered";
export type PdfLogoPlacement = "Watermark" | "Header" | "Both" | "None";

// This studio's quotation PDF look. Nothing set = the original Classic design.
export interface PdfSettings {
  template: PdfTemplate;
  headerStyle: PdfHeaderStyle;
  primaryColor: string;
  accentColor: string;
  logoPlacement: PdfLogoPlacement;
  displayName: string;
  tagline: string;
  showWebsite: boolean;
  footerText: string;
  showPageNumbers: boolean;
  useDefaultTerms: boolean;
  showSignature: boolean;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  showPaymentDetails: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  paymentNote: string;
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

// ---- Tomorrow's WhatsApp reminders (two separate messages)

export interface ReminderRecipient {
  name: string;
  kind: "Owner" | "Worker";
  phone: string | null;
  eventCount: number;
  willReceive: boolean;
  note: string | null;
}

export interface ReminderMessagePreview {
  title: string;
  text: string;
  recipients: ReminderRecipient[];
}

export interface ReminderChecks {
  eventMessageHasNoPaymentInfo: boolean;
  paymentMessageIsOwnerOnly: boolean;
  workersReceivingPaymentMessage: number;
}

export interface ReminderPreview {
  isTest: boolean;
  date: string;
  eventCount: number;
  provider: string;
  warnings: string[];
  eventMessage: ReminderMessagePreview;
  paymentMessage: ReminderMessagePreview;
  checks: ReminderChecks;
  sendResults: string[];
}

export interface ReminderRunResult {
  sent: number;
  failed: number;
  skipped: number;
}
