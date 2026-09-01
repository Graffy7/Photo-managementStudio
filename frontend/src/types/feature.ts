export interface StudioFeature {
  featureId: number;
  featureCode: string;
  featureName: string;
  description: string | null;
  isEnabled: boolean;
  enabledAt: string | null;
}
