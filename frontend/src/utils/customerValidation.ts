import axios from "axios";

// Same rules as the server (CustomerValidators / MobileNumberRules), checked as the owner types so
// problems show under the field instead of after a round trip.
export function mobileError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter the customer's mobile number.";
  const digits = v.replace(/\D/g, "").length;
  if (!/^\+?[0-9 ()-]{7,20}$/.test(v) || digits < 7 || digits > 15) return "Enter a valid mobile number (7-15 digits).";
  return null;
}

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter the customer's name.";
  if (v.length > 200) return "Keep the name under 200 characters.";
  return null;
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address, or leave it empty.";
  return null;
}

export interface DuplicateCustomer {
  customerId: number;
  fullName: string;
  isActive: boolean;
  message: string;
}

// The server's "this mobile number is already a customer" answer (409 DUPLICATE_MOBILE), if that's what it was.
export function duplicateFrom(err: unknown): DuplicateCustomer | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return null;
  const d = err.response.data as { code?: string; message?: string; existingCustomerId?: number; existingCustomerName?: string; existingIsActive?: boolean };
  if (d?.code !== "DUPLICATE_MOBILE" || !d.existingCustomerId) return null;
  return { customerId: d.existingCustomerId, fullName: d.existingCustomerName ?? "", isActive: !!d.existingIsActive, message: d.message ?? "" };
}

// Server-side field errors (400 ValidationProblem) by field name.
export function fieldErrorsFrom(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const errors = (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) out[k.charAt(0).toLowerCase() + k.slice(1)] = v[0];
  return out;
}
