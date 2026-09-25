export interface Plan {
  planId: number;
  name: string;
  months: number;
  price: number;
  pricePerMonth: number;
  description: string | null;
  newExpiry: string;
}

export interface BillingHistoryItem {
  kind: "Online" | "Manual";
  date: string;
  planName: string | null;
  months: number;
  amount: number;
  status: "Paid" | "Failed" | "Pending";
  method: string | null;
  transactionId: string | null;
  orderId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  failureReason: string | null;
}

export interface SubscriptionStatus {
  hasAccess: boolean;
  // Full: everything; ReadOnly: view only (subscription lapsed or set by the platform); None: suspended.
  accessLevel: "Full" | "ReadOnly" | "None";
  status: "Active" | "Trial" | "Complimentary" | "Expired" | "NoSubscription" | "ReadOnly" | "Suspended" | "Inactive";
  isTrial: boolean;
  planName: string | null;
  startDate: string | null;
  expiryDate: string | null;
  daysRemaining: number;
  lastAmountPaid: number | null;
  lastPaymentStatus: string | null;
  lastPaymentDate: string | null;
  autoRenew: boolean;
  onlinePaymentsAvailable: boolean;
  serverTime: string;
  plans: Plan[];
  history: BillingHistoryItem[];
}

export interface Checkout {
  gateway: string;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
  studioName: string;
  email: string | null;
  phone: string | null;
}
