export interface ExpenseCategory {
  expenseCategoryId: number;
  categoryName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseCategoryRequest {
  categoryName: string;
  description?: string;
}

export type UpdateExpenseCategoryRequest = CreateExpenseCategoryRequest;
