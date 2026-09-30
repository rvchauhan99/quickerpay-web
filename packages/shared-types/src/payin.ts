/**
 * Pay-In contract, docs/04_API_CONTRACT.md section 8.5.
 * Money is integer paise named `_minor`.
 */

import type { CommissionSnapshot } from './commission'
import type { PayinStatus } from './domain'

export interface PayinListItem {
  id: string
  transaction_id: string
  reference: string
  utr: string | null
  /**
   * Panel party username (Supago/Crici depositor wusername).
   * Omitted for Banker / Operator / Auditor (canSeeMerchants); null when SA/Admin and not ingested.
   */
  customer_ref?: string | null
  amount_minor: number
  status: PayinStatus
  auto_accepted: boolean
  /** Omitted for Banker / Operator / Auditor (canSeeMerchants). */
  merchant_id?: string
  /** Merchant display name when joined; omitted when actor cannot see merchants. */
  merchant_display_name?: string | null
  assigned_upi_id: string | null
  assigned_operator_id: string | null
  created_at: string
  in_progress_at: string | null
  action_at: string | null
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
