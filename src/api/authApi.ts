import { apiClient } from "./client";
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  UserProfile,
} from "../types/auth";

export const authApi = {
  login: (request: LoginRequest) =>
    apiClient.post<LoginResponse>("/api/auth/login", request).then((res) => res.data),

  refresh: (refreshToken: string) =>
    apiClient.post<LoginResponse>("/api/auth/refresh", { refreshToken }).then((res) => res.data),

  logout: (refreshToken: string) => apiClient.post("/api/auth/logout", { refreshToken }),

  forgotPassword: (request: ForgotPasswordRequest) =>
    apiClient.post<{ message: string }>("/api/auth/forgot-password", request).then((res) => res.data),

  resetPassword: (request: ResetPasswordRequest) =>
    apiClient.post<{ message: string }>("/api/auth/reset-password", request).then((res) => res.data),

  changePassword: (request: ChangePasswordRequest) =>
    apiClient.post<{ message: string }>("/api/auth/change-password", request).then((res) => res.data),

  me: () => apiClient.get<UserProfile>("/api/auth/me").then((res) => res.data),
};
