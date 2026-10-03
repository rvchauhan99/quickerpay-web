/**
 * Merchants contract, docs/04_API_CONTRACT.md section 8.3.
 * Rates are integer basis points named `_bp`.
 */

import type { MerchantStatus, RateKind } from './domain'

export type BankBankerMode = 'ALL' | 'SELECTED'
/** @deprecated Use BankBankerMode */
export type BankAdminMode = BankBankerMode

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
   * NULL = panel withdraws land in Super Admin unassigned queue.
   * Set = poll auto-assigns to this ACTIVE Banker (fallback to unassigned if invalid).
   */
  default_payout_banker_user_id: string | null
  default_payout_banker_username: string | null
  /** Who may sync/enable banks on this Exchange Master's panel. */
  bank_banker_mode: BankBankerMode
  /** Populated when bank_banker_mode is SELECTED; empty when ALL. */
  bank_banker_user_ids: string[]
  /**
   * Permanent panel lock after first connect. Credential clear does not reset to NONE.
   * Cross-panel switch is rejected by the API.
   */
  integration_type: 'NONE' | 'SUPAGO' | 'CRICI' | 'API'
  /** Exchange Master portal login (`users.role = MERCHANT`), if enabled. */
  portal_user_id: string | null
  portal_username: string | null
  portal_user_status: 'ACTIVE' | 'DISABLED' | 'SUSPENDED' | null
}

export interface MerchantPortalEnableResult {
  user_id: string
  username: string
  temporary_password: string
  require_password_change: true
}
