/**
 * Pay-Out contract, docs/04_API_CONTRACT.md section 8.6.
 * Money is integer paise named `_minor`. Beneficiary accounts arrive `_masked`.
 */

import type { CommissionSnapshot } from './commission'
import type { PayoutStatus } from './domain'

export interface PayoutListItem {
  id: string
  transaction_id: string
  reference: string
  utr: string | null
  amount_minor: number
  status: PayoutStatus
  merchant_id: string
  source_bank_account_id: string | null
  assigned_operator_id: string | null
  beneficiary_name: string
  beneficiary_account_masked: string
  failure_reason: string | null
  created_at: string
  in_progress_at: string | null
  action_at: string | null
}

export interface PayoutSuccessResult {
  transaction: {
    reference: string
    status: PayoutStatus
    amount_minor: number
  }
  commission: CommissionSnapshot | null
  ledger: {
    posting_group_id: string
    operational_direction: 'CREDIT'
    balance_after_minor: number
  }
}
