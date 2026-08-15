/**
 * Tenant audit log reads, docs/03_MODULES_AND_SCREENS.md section 4.18.
 */

export interface AuditLogItem {
  id: string
  created_at: string
  actor_id: string | null
  actor: string | null
  role: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  request_id: string | null
}
