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
  /** Supago depositor wusername when ingested; null for lab/manual creates without it. */
  customer_ref: string | null
  amount_minor: number
  status: PayinStatus
  auto_accepted: boolean
  merchant_id: string
  /** Merchant display name when joined; null if merchant row missing. */
  merchant_display_name: string | null
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
