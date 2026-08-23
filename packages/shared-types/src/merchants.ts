/**
 * Merchants contract, docs/04_API_CONTRACT.md section 8.3.
 * Rates are integer basis points named `_bp`.
 */

import type { MerchantStatus, RateKind } from './domain'

export interface MerchantRate {
  rate_kind: RateKind
  rate_bp: number
  basis: string
  effective_from: string
}

export interface MerchantListItem {
  id: string
  merchant_code: string
  legal_name: string
  display_name: string
  status: MerchantStatus
  created_at: string
}

export interface MerchantDetail extends MerchantListItem {
  contact_email: string | null
  contact_mobile: string | null
  rates: MerchantRate[]
  /**
   * NULL = Supago withdraws land in Super Admin unassigned queue.
   * Set = poll auto-assigns to this ACTIVE Admin (fallback to unassigned if invalid).
   */
  default_payout_admin_user_id: string | null
  default_payout_admin_username: string | null
}
