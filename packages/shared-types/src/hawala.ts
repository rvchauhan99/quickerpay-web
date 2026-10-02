/**
 * Party Master + Hawala contracts.
 * Debit/Credit = Party | Exchange Master | Banker. No bank legs.
 */

import type { HawalaPartyKind, HawalaStatus, PartyStatus } from './domain'

export interface PartyListItem {
  id: string
  party_code: string
  display_name: string
  status: PartyStatus
  /** Closing balance from PARTY_BALANCE ledger (paise). */
  balance_minor: number
  created_at: string
  updated_at: string
}

export interface PartyBalanceView {
  party: PartyListItem
  ledger_account_code: string
  balance_minor: number
}

export interface HawalaPartyRef {
  kind: HawalaPartyKind
  id: string
  label: string
  /** Current ledger balance before this transfer (when known). */
  balance_minor: number | null
}

export interface HawalaListItem {
  id: string
  transaction_id: string
  reference: string
  amount_minor: number
  status: HawalaStatus
  debit: HawalaPartyRef
  credit: HawalaPartyRef
  utrs: string[]
  remark: string | null
  client_reference: string | null
  reversal_of: string | null
  created_by: string
  approved_by: string | null
  created_at: string
  completed_at: string | null
}

export interface HawalaPostResult {
  transfer: HawalaListItem
  ledger: {
    transfer_out_group_id: string
    transfer_in_group_id: string
  }
}
