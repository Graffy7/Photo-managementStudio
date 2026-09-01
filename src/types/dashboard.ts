export interface PlanDistribution {
  planName: string;
  studioCount: number;
}

export interface DashboardSummary {
  totalStudios: number;
  activeStudios: number;
  blockedStudios: number;
  newStudiosThisMonth: number;
  expiredSubscriptions: number;
  expiringSoon: number;
  totalRevenue: number;
  revenueThisMonth: number;
  planDistribution: PlanDistribution[];
}
