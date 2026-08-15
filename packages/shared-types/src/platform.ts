/**
 * Platform database health, docs/03_MODULES_AND_SCREENS.md section 3.3.
 */

export interface TenantHealthRow {
  tenant_id: string
  slug: string
  db_name: string
  health_status: string
  schema_version: string
  expected_version: string
  pool_in_use: number | null
  pool_max: number
  last_health_check_at: string | null
  last_backup_at: string | null
  last_invariant_status: string | null
  mismatch: boolean
}
