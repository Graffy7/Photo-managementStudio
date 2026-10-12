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
  // On the event's agreed price.
  eventTotal: number;
  paidExpenses: number;
  pendingExpenses: number;
  netProfit: number;
  profitMarginPercent: number | null;
  outstandingBalance: number;
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
  eventsTotalAmount: number;
  eventsExpenses: number;
  eventsPendingExpenses: number;
  eventsNetProfit: number;
  eventsOutstandingBalance: number;
  events: EventProfit[];
  expensesByCategory: ExpenseCategoryBreakdown[];
}
