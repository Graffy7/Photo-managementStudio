import { apiClient } from "./client";
import type { AssignedWorker, DayBoard, MonthEvents } from "../types/dayBoard";

export const dayBoardApi = {
  getDayBoard: (date: string) => apiClient.get<DayBoard>("/api/day-board", { params: { date } }).then((res) => res.data),

  getMonth: (year: number, month: number) =>
    apiClient.get<MonthEvents[]>("/api/day-board/month", { params: { year, month } }).then((res) => res.data),

  assignWorker: (eventId: number, workerId: number, notes?: string) =>
    apiClient.post<AssignedWorker>(`/api/events/${eventId}/workers`, { workerId, notes }).then((res) => res.data),

  unassignWorker: (eventId: number, workerId: number) => apiClient.delete(`/api/events/${eventId}/workers/${workerId}`),
};
