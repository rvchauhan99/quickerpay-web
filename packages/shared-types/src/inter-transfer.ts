/**
 * Inter Transfer contract, docs/04_API_CONTRACT.md section 8.8.
 * viewer_direction is computed per caller and is never stored.
 */

import type { InterTransferStatus, LedgerDirection, TransferType } from './domain'

export interface InterTransferListItem {
  id: string
  transaction_id: string
  reference: string
  transfer_type: TransferType
  amount_minor: number
  status: InterTransferStatus
  source_user_id: string
  source_username: string
  source_bank_account_id: string
  source_bank_label: string
  source_account_masked: string | null
  destination_user_id: string
  destination_username: string
  destination_bank_account_id: string
  destination_bank_label: string
  destination_account_masked: string | null
  utrs: string[]
  remark: string | null
  client_reference: string | null
  reversal_of: string | null
  created_by: string
  approved_by: string | null
  created_at: string
  completed_at: string | null
  viewer_direction: LedgerDirection | null
}

export interface InterTransferPostResult {
  transfer: InterTransferListItem
  ledger: {
    transfer_out_group_id: string
    transfer_in_group_id: string
  }
}
