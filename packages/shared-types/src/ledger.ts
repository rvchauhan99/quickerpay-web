/**
 * Ledger read and posting contract, docs/04_API_CONTRACT.md section 8.9.
 * Money is integer paise named `_minor`.
 */

import type { LedgerDirection } from './domain'

export const LEDGER_EVENT_TYPES = [
  'PAYIN',
  'PAYOUT',
  'CHARGES',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT',
  'REFUND',
  'OPENING',
] as const
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number]

export interface LedgerLine {
  id: string | null
  created_at: string
  event_type: LedgerEventType
  direction: LedgerDirection | null
  credit_minor: number
  debit_minor: number
  balance_after_minor: number
  remark: string | null
  reference: string | null
  utr: string | null
}

export interface LedgerStatement {
  ledger_account_id: string
  code: string
  owner_user_id: string | null
  owner_display_name: string | null
  opening_balance_minor: number
  lines: LedgerLine[]
}

export interface LedgerAdjustment {
  id: string
  reference: string
  owner_user_id: string
  amount_minor: number
  direction: LedgerDirection
  status: string
  reason: string
  created_by: string
  created_at: string
}

export interface PostingGroup {
  posting_group_id: string
  transaction_id: string | null
}
