/**
 * Commission snapshot on the wire, docs/04_API_CONTRACT.md section 8.5 and 8.9.
 * Money is integer paise named `_minor`. Rates are integer basis points named `_bp`.
 */

import type { RateKind } from './domain'

export interface CommissionSnapshot {
  rate_kind: RateKind
  eligible_amount_minor: number
  merchant_rate_bp: number
  admin_rate_bp: number
  margin_rate_bp: number
  merchant_commission_minor: number
  admin_commission_minor: number
  margin_minor: number
}

export interface CommissionKindTotals {
  rate_kind: RateKind
  eligible_volume_minor: number
  merchant_commission_minor: number
  admin_commission_minor: number
  margin_minor: number
  reversals_minor: number
  net_minor: number
}

export interface CommissionSummary {
  kinds: CommissionKindTotals[]
  total: Omit<CommissionKindTotals, 'rate_kind'>
}

export interface CommissionEntry {
  id: string
  transaction_id: string
  rate_kind: RateKind
  merchant_id: string
  admin_user_id: string
  eligible_amount_minor: number
  merchant_rate_bp: number
  admin_rate_bp: number
  merchant_commission_minor: number
  admin_commission_minor: number
  margin_minor: number | null
  created_at: string
}
