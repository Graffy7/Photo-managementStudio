export interface Worker {
  workerId: number;
  fullName: string;
  mobileNumber: string | null;
  email: string | null;
  workerTypeId: number | null;
  workerTypeName: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkerRequest {
  fullName: string;
  mobileNumber?: string;
  email?: string;
  workerTypeId?: number;
  notes?: string;
}

export type UpdateWorkerRequest = CreateWorkerRequest;
