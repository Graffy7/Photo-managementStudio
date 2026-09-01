export interface Lookup {
  id: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
}

export interface CreateLookupRequest {
  name: string;
  displayOrder?: number;
}

export interface UpdateLookupRequest {
  name: string;
  isActive: boolean;
  displayOrder?: number;
}
