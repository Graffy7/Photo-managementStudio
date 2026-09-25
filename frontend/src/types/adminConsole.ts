export type AdminStudioStatus = "Active" | "Trial" | "Expired" | "NoPlan" | "Blocked" | "Inactive";

export interface MonthValue {
  month: string; // yyyy-MM
  value: number;
}

export interface StudioStorage {
  studioId: number;
  studioName: string;
  originalBytes: number;
  previewBytes: number;
  thumbnailBytes: number;
  appBytes: number;
  photoCount: number;
  missingOriginals: number;
}

export interface AdminOverview {
  totalStudios: number;
  activeSubscriptions: number;
  activeTrials: number;
  expired: number;
  blocked: number;
  expiringIn7Days: number;
  totalRevenue: number;
  rangeRevenue: number;
  appStorageBytes: number;
  originalStorageBytes: number;
  rangeStart: string;
  rangeEnd: string;
  revenueByMonth: MonthValue[];
  newStudiosByMonth: MonthValue[];
  statusBreakdown: Record<AdminStudioStatus, number>;
  storageByStudio: StudioStorage[];
}

export interface AdminStudioRow {
  studioId: number;
  studioName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  phoneNumber: string | null;
  status: AdminStudioStatus;
  isActive: boolean;
  isBlocked: boolean;
  planName: string | null;
  isTrial: boolean;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  monthsSubscribed: number;
  totalPaid: number;
  paymentCount: number;
  appStorageBytes: number;
  originalStorageBytes: number;
  lastActiveAt: string | null;
  createdAt: string;
  accessMode: "Auto" | "Full" | "ReadOnly";
  accessLevel: "Full" | "ReadOnly" | "None";
}

export interface AdminStudioDetail {
  studio: AdminStudioRow;
  address: string | null;
  city: string | null;
  loginEmail: string | null;
  lastLoginAt: string | null;
  subscriptionPlanId: number | null;
  planPrice: number | null;
  planDurationDays: number | null;
  usage: { todayMinutes: number; last7DaysMinutes: number; last30DaysMinutes: number; activeDaysLast30: number };
}

export interface AdminStudioUsage {
  storage: StudioStorage;
  records: Record<string, number>;
  featureUsage: { name: string; count: number }[];
  daily: { date: string; activeMinutes: number; requests: number }[];
  lastActivityAt: string | null;
  storageMeasuredAt: string | null;
}

export interface AdminPayment {
  paymentId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  planName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  months: number;
}

export interface AdminSubscription {
  status: AdminStudioStatus;
  isTrial: boolean;
  subscriptionPlanId: number | null;
  planName: string | null;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  monthsPurchased: number;
  paymentCount: number;
  totalPaid: number;
  payments: AdminPayment[];
}

export interface AdminActivity {
  id: number;
  createdAt: string;
  studioId: number | null;
  studioName: string | null;
  module: string;
  action: string;
  userName: string | null;
  userType: string | null;
  ipAddress: string | null;
  device: string | null;
}

export interface LedgerRow {
  date: string;
  studioId: number;
  studioName: string;
  kind: "Online" | "Manual";
  planName: string | null;
  months: number;
  amount: number;
  status: "Paid" | "Failed" | "Pending";
  method: string | null;
  transactionId: string | null;
  orderId: string | null;
  failureReason: string | null;
}

export interface LedgerPage {
  items: LedgerRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  paidTotal: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface ManualPaymentRequest {
  subscriptionPlanId?: number;
  months: number;
  amount: number;
  paymentDate?: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}
