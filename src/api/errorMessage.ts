import axios from "axios";

export function extractErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!axios.isAxiosError(err)) return fallback;

  const data = err.response?.data as { message?: string; errors?: Record<string, string[]>; title?: string } | undefined;
  if (data?.message) return data.message;

  const firstFieldError = data?.errors && Object.values(data.errors)[0]?.[0];
  if (firstFieldError) return firstFieldError;

  if (data?.title) return data.title;

  return fallback;
}
