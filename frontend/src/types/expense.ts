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
}

export type UpdateExpenseRequest = CreateExpenseRequest;
