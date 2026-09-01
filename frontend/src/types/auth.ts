export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface UserProfile {
  userId: number;
  fullName: string;
  email: string;
  userType: "SUPER_ADMIN" | "STUDIO_OWNER";
  studioId: number | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: UserProfile;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
