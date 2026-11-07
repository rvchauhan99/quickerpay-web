/**
 * Pay-In contract, docs/04_API_CONTRACT.md section 8.5.
 * Money is integer paise named `_minor`.
 */

import type { CommissionSnapshot } from './commission'
import type { PayinPaymentMethod, PayinStatus, TxnSource } from './domain'
import type { GatewayPayInstructions, GatewayPaymentMethodItem } from './gateway'

export interface PayinListItem {
  id: string
  transaction_id: string
  reference: string
  utr: string | null
  /** Collection method (UPI / MANUAL_BANK / USDT_TRC20 / PENDING_METHOD before hosted select). */
  payment_method: PayinPaymentMethod
  /**
   * Panel party username (Supago/Crici depositor wusername).
   * Omitted for Banker / Operator / Auditor (canSeeMerchants); null when SA/Admin and not ingested.
   */
  customer_ref?: string | null
  amount_minor: number
  status: PayinStatus
  /**
   * Reject/expiry note from `payin_requests.review_reason`.
   * Gateway unpaid timeout stores `EXPIRED` while `status` stays `REJECTED`.
   * Null when open or completed without a reject reason.
   */
  review_reason: string | null
  auto_accepted: boolean
  /** True when created via Pay-In Injection (manual SA/Admin create; never panel-linked). */
  is_injection: boolean
  /** When the UTR was submitted (Exchange portal injection, or gateway / hosted pay page). */
  utr_submitted_at: string | null
  /** Where the row came from: MANUAL, SUPAGO, CRICI, API (gateway) or INJECTION. */
  source: TxnSource
  /** Omitted for Banker / Operator / Auditor (canSeeMerchants). */
  merchant_id?: string
  /** Merchant display name when joined; omitted when actor cannot see merchants. */
  merchant_display_name?: string | null
  /** Banker owning the injection (set at create); useful for UPI filtering on accept. */
  banker_user_id?: string | null
  /**
   * Username of `transactions.banker_user_id`.
   * Present for Super Admin, Admin, and Auditor (`canSeePayinBanker`); null when unassigned.
   * Omitted for Banker, Operator, and Exchange Master.
   */
  banker_username?: string | null
  assigned_upi_id: string | null
  assigned_operator_id: string | null
  created_at: string
  in_progress_at: string | null
  action_at: string | null
}

/**
 * MERCHANT portal Add Pay-In create response: list item plus hosted-style pay view
 * for same-page QR / UTR (no public pay-link token).
 */
export interface PortalPayinPayView {
  transaction_number: string
  amount_minor: number
  payment_method: PayinPaymentMethod
  pay_instructions: GatewayPayInstructions
  upi: string | null
  payee_name: string
  status: PayinStatus
  utr_submitted: boolean
  expires_at: string | null
  available_methods?: GatewayPaymentMethodItem[]
}

export interface PortalPayinCreateResult {
  payin: PayinListItem
  pay_view: PortalPayinPayView
}

export interface PayinDetail extends PayinListItem {
  /** VPA of the assigned UPI. Null when the pay-in has no UPI yet. */
  assigned_upi_address: string | null
  /** True when a UTR proof image is stored for this pay-in. */
  has_utr_proof: boolean
}

export interface PayinProofView {
  url: string
  filename: string
  mime_type: string
}

export interface PayinAcceptResult {
  transaction: {
    reference: string
    status: PayinStatus
    amount_minor: number
  }
  commission: CommissionSnapshot | null
  ledger: {
    posting_group_id: string
    operational_direction: 'DEBIT' | 'CREDIT'
    balance_after_minor: number
  }
}
