export interface AuditLogEntry {
  auditLogId: number;
  action: string;
  module: string;
  studioId: number | null;
  studioName: string | null;
  userId: number | null;
  actorName: string | null;
  createdAt: string;
}
