export interface Customer {
  customerId: number;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  fullName: string;
  mobileNumber: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type UpdateCustomerRequest = CreateCustomerRequest;
