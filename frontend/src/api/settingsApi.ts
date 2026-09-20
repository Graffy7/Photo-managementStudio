import { apiClient } from "./client";
import type {
  BusinessSettings,
  NotificationSettings,
  ReminderPreview,
  ReminderRunResult,
  QuotationSettings,
  StudioProfile,
  UpdateStudioProfileRequest,
} from "../types/settings";

export const settingsApi = {
  getProfile: () => apiClient.get<StudioProfile>("/api/studio-profile").then((res) => res.data),

  updateProfile: (request: UpdateStudioProfileRequest) =>
    apiClient.put<StudioProfile>("/api/studio-profile", request).then((res) => res.data),

  // Native RN needs {uri, name, type}; web needs a real Blob/File (with the filename passed
  // separately to FormData.append, since a plain Blob carries no name of its own).
  uploadLogo: (file: { uri: string; name: string; type: string } | Blob, fileName?: string) => {
    const formData = new FormData();
    if (file instanceof Blob) {
      formData.append("file", file, fileName ?? "logo.jpg");
    } else {
      formData.append("file", file as any);
    }
    return apiClient
      .post<StudioProfile>("/api/studio-profile/logo", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data);
  },

  removeLogo: () => apiClient.delete<StudioProfile>("/api/studio-profile/logo").then((res) => res.data),

  getBusinessSettings: () => apiClient.get<BusinessSettings>("/api/studio-settings/business").then((res) => res.data),

  updateBusinessSettings: (request: BusinessSettings) =>
    apiClient.put<BusinessSettings>("/api/studio-settings/business", request).then((res) => res.data),

  getNotificationSettings: () =>
    apiClient.get<NotificationSettings>("/api/studio-settings/notifications").then((res) => res.data),

  updateNotificationSettings: (request: NotificationSettings) =>
    apiClient.put<NotificationSettings>("/api/studio-settings/notifications", request).then((res) => res.data),

  // Builds tomorrow's two WhatsApp reminder messages and shows them separately, marked TEST. Nothing is
  // sent unless sendToOwner is true — and then only to the studio owner's own number, never a worker's.
  testWhatsAppReminder: (request: { eventId?: number; sendToOwner?: boolean }) =>
    apiClient.post<ReminderPreview>("/api/notifications/whatsapp-reminders/test", request).then((res) => res.data),

  sendWhatsAppRemindersNow: () =>
    apiClient.post<ReminderRunResult>("/api/notifications/whatsapp-reminders/send-now").then((res) => res.data),

  getQuotationSettings: () => apiClient.get<QuotationSettings>("/api/studio-settings/quotation").then((res) => res.data),

  updateQuotationSettings: (request: QuotationSettings) =>
    apiClient.put<QuotationSettings>("/api/studio-settings/quotation", request).then((res) => res.data),
};
