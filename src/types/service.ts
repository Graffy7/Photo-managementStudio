export interface StudioService {
  serviceId: number;
  serviceName: string;
  description: string | null;
  defaultPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceRequest {
  serviceName: string;
  description?: string;
  defaultPrice: number;
}

export type UpdateServiceRequest = CreateServiceRequest;
