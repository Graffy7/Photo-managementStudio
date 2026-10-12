export type ExpensePaymentStatus = "Paid" | "Pending";

// Offered on every expense form; a studio's own list gains each one the first time it is used.
export const STANDARD_EXPENSE_CATEGORIES = [
  "Photographer", "Videographer", "Drone", "Travel", "Food", "Accommodation", "Album printing", "Equipment rental", "Other",
];

export interface Expense {
  expenseId: number;
  expenseCategoryId: number;
  expenseCategoryName: string;
  eventId: number | null;
  eventVenue: string | null;
  workerId: number | null;
  workerName: string | null;
  expenseDate: string;
  amount: number;
  description: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  vendorName: string | null;
  paymentStatus: ExpensePaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  expenseCategoryId: number;
  eventId?: number;
  workerId?: number;
  expenseDate: string;
  amount: number;
  description?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  vendorName?: string;
  paymentStatus?: ExpensePaymentStatus;
}

// One event's expenses and profit. Profit is on the agreed price (totalEventAmount), not on what
// has been collected; customer money and the studio's own unpaid bills are reported separately.
export interface EventExpenseSummary {
  eventId: number;
  totalEventAmount: number;
  totalExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  netProfit: number;
  profitMarginPercent: number | null;
  amountReceived: number;
  outstandingBalance: number;
  expenses: Expense[];
}

export type UpdateExpenseRequest = CreateExpenseRequest;
