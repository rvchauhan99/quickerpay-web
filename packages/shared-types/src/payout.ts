/**
 * Pay-Out contract, docs/04_API_CONTRACT.md section 8.6.
 * Money is integer paise named `_minor`.
 * Beneficiary account + IFSC are returned in full so operators can pay without a reveal step.
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
  admin_user_id: string | null
  source_bank_account_id: string | null
  assigned_operator_id: string | null
  /** Supago wusername from transactions.gateway_reference; null for lab creates. */
  supago_username: string | null
  beneficiary_name: string
  /** Full decrypted account number. */
  beneficiary_account: string
  /** @deprecated Prefer beneficiary_account; kept equal to full account for older clients. */
  beneficiary_account_masked: string
  /** Decrypted IFSC when stored; needed to pay. */
  beneficiary_ifsc: string | null
  beneficiary_bank_name: string | null
  /** Player UPI payee when withdrawal has no bank account (Crici payment_detail.upi_id). */
  beneficiary_upi: string | null
  failure_reason: string | null
  merchant_order_id: string | null
  has_attachment: boolean
  attachment_filename: string | null
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

export interface PayoutAttachmentView {
  url: string
  filename: string
  mime_type: string
  uploaded_at: string
}

export interface PayoutBeneficiaryReveal {
  account_number: string
  ifsc: string | null
}
