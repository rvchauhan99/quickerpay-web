/**
 * Dashboard summary, docs/04_API_CONTRACT.md section 8.9 and docs/03 section 4.1–4.3.
 * Money is integer paise named `_minor`.
 */

export interface DashboardCard {
  amount_minor: number
  count: number
  margin_minor?: number
}

export interface DashboardAdminRow {
  admin_user_id: string
  admin_username: string
  payin_minor: number
  payout_minor: number
  commission_minor: number
  margin_minor: number
}

export interface DashboardKindCommission {
  rate_kind: 'PAYIN' | 'PAYOUT'
  admin_commission_minor: number
  margin_minor: number
}

export interface DashboardSummary {
  payin: DashboardCard
  payout: DashboardCard
  commission: DashboardCard
  inter_transfer: DashboardCard
  refunded_minor: number
  /** Live ADMIN_BALANCE. Date filters do not apply. Null when the caller has no Admin ledger. */
  my_account_minor: number | null
  admin_wise: DashboardAdminRow[]
  pending_approvals: number
  failed_transactions: number
  unmatched_utrs: number
  operators_online: number
  pending_utrs: number
  assigned_queue_depth: number
  processed_today: number
  commission_by_kind: DashboardKindCommission[]
}
