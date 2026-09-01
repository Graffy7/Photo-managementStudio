import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { Notification } from "../types/notification";

export const notificationsApi = {
  search: (params: { isRead?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Notification>>("/api/notifications", { params }).then((res) => res.data),

  getUnreadCount: () => apiClient.get<{ count: number }>("/api/notifications/unread-count").then((res) => res.data.count),

  markAsRead: (id: number) => apiClient.post<Notification>(`/api/notifications/${id}/read`).then((res) => res.data),

  markAllAsRead: () => apiClient.post<{ updated: number }>("/api/notifications/mark-all-read").then((res) => res.data),

  checkEventReminders: () =>
    apiClient.post<{ created: number }>("/api/notifications/check-event-reminders").then((res) => res.data),
};
