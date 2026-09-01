export interface SubscriptionPlan {
  subscriptionPlanId: number;
  planName: string;
  planType: string;
  price: number;
  durationInDays: number;
}

export interface SubscriptionPayment {
  subscriptionPaymentId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
}

export interface RenewSubscriptionRequest {
  subscriptionPlanId?: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}
