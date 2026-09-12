export interface AssignedWorker {
  eventWorkerId: number;
  workerId: number;
  workerName: string;
  workerMobileNumber: string | null;
  workerTypeName: string | null;
  notes: string | null;
}

export interface DayBoardEvent {
  eventId: number;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  customerName: string;
  customerMobileNumber: string;
  eventTypeName: string | null;
  eventStatus: string;
  budget: number | null;
  amountPaid: number;
  balance: number;
  notes: string | null;
  workers: AssignedWorker[];
}

export interface DayBoard {
  date: string;
  events: DayBoardEvent[];
}

export interface MonthEvents {
  date: string;
  events: DayBoardEvent[];
}
