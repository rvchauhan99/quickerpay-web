/**
 * Dashboard summary, docs/04_API_CONTRACT.md section 8.9 and docs/03 section 4.1–4.3.
 * Money is integer paise named `_minor`.
 */

export interface DashboardCard {
  amount_minor: number
  count: number
  margin_minor?: number
}

export interface DashboardBankerRow {
  banker_user_id: string
  banker_username: string
  payin_minor: number
  payout_minor: number
  commission_minor: number
  margin_minor: number
}

export interface DashboardKindCommission {
  rate_kind: 'PAYIN' | 'PAYOUT'
  banker_commission_minor: number
  margin_minor: number
}

export interface DashboardSummary {
  payin: DashboardCard
  payout: DashboardCard
  commission: DashboardCard
  /** @deprecated Prefer hawala — same card, legacy name */
  inter_transfer?: DashboardCard
  hawala: DashboardCard
  refunded_minor: number
  /** Live BANKER_BALANCE. Date filters do not apply. Null when the caller has no Banker ledger. */
  my_account_minor: number | null
  banker_wise: DashboardBankerRow[]
  pending_approvals: number
  failed_transactions: number
  unmatched_utrs: number
  operators_online: number
  pending_utrs: number
  assigned_queue_depth: number
  processed_today: number
  commission_by_kind: DashboardKindCommission[]
}
