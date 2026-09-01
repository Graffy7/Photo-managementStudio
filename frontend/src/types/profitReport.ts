export interface EventProfit {
  eventId: number;
  eventDate: string;
  venue: string | null;
  customerName: string;
  quotationValue: number;
  collectedRevenue: number;
  expenses: number;
  expectedProfit: number;
  cashProfit: number;
}

export interface ExpenseCategoryBreakdown {
  categoryName: string;
  totalAmount: number;
}

export interface ProfitReport {
  rangeStart: string;
  rangeEnd: string;
  totalQuotationValue: number;
  totalCollectedRevenue: number;
  totalExpenses: number;
  totalExpectedProfit: number;
  totalCashProfit: number;
  events: EventProfit[];
  expensesByCategory: ExpenseCategoryBreakdown[];
}
