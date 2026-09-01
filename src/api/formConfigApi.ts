import { apiClient } from "./client";
import type { CreateCustomFieldRequest, FormField, UpdateFormFieldRequest } from "../types/formField";

export const formConfigApi = {
  getFields: (formCode: string) =>
    apiClient.get<FormField[]>(`/api/form-config/${formCode}/fields`).then((res) => res.data),

  updateField: (formCode: string, formFieldId: number, request: UpdateFormFieldRequest) =>
    apiClient.put<FormField>(`/api/form-config/${formCode}/fields/${formFieldId}`, request).then((res) => res.data),

  addCustomField: (formCode: string, request: CreateCustomFieldRequest) =>
    apiClient.post<FormField>(`/api/form-config/${formCode}/fields`, request).then((res) => res.data),
};
