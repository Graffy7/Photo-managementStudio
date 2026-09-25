import { apiClient } from "./client";
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetChannel,
  ForgotPasswordOptions,
  SendResetCodeResponse,
  VerifyResetCodeResponse,
  UserProfile,
} from "../types/auth";

export const authApi = {
  login: (request: LoginRequest) =>
    apiClient.post<LoginResponse>("/api/auth/login", request).then((res) => res.data),

  refresh: (refreshToken: string) =>
    apiClient.post<LoginResponse>("/api/auth/refresh", { refreshToken }).then((res) => res.data),

  logout: (refreshToken: string) => apiClient.post("/api/auth/logout", { refreshToken }),

  forgotPasswordOptions: () =>
    apiClient.get<ForgotPasswordOptions>("/api/auth/forgot-password/options").then((res) => res.data),

  sendResetCode: (channel: ResetChannel, identifier: string) =>
    apiClient.post<SendResetCodeResponse>("/api/auth/forgot-password/send-code", { channel, identifier }).then((res) => res.data),

  verifyResetCode: (channel: ResetChannel, identifier: string, code: string) =>
    apiClient.post<VerifyResetCodeResponse>("/api/auth/forgot-password/verify-code", { channel, identifier, code }).then((res) => res.data),

  resetPassword: (request: ResetPasswordRequest) =>
    apiClient.post<{ message: string }>("/api/auth/reset-password", request).then((res) => res.data),

  changePassword: (request: ChangePasswordRequest) =>
    apiClient.post<{ message: string }>("/api/auth/change-password", request).then((res) => res.data),

  me: () => apiClient.get<UserProfile>("/api/auth/me").then((res) => res.data),

  logoutEverywhere: () => apiClient.post<{ message: string }>("/api/auth/logout-everywhere").then((res) => res.data),
};
