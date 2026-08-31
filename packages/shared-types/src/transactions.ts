/**
 * Transactions list and support detail, docs/04 section 8.9 and docs/03 section 4.16.
 * Money is integer paise named `_minor`.
 */

import type { CommissionSnapshot } from './commission'
import type { LedgerLine } from './ledger'
import type { TransactionType } from './domain'

export interface TransactionListItem {
  id: string
  reference: string
  type: TransactionType
  created_at: string
  merchant_id: string | null
  admin_user_id: string | null
  admin_username: string | null
  amount_minor: number
  status: string
  utr: string | null
  /**
   * Supago party username: pay-in depositor (`payin_requests.customer_ref`) or
   * pay-out withdrawer (`transactions.gateway_reference`). Null for other types / lab rows.
   */
  customer_ref: string | null
}

export interface TransactionEventItem {
  id: string
  created_at: string
  from_status: string | null
  to_status: string
  event_type: string
  actor_id: string | null
  reason: string | null
}

export interface TransactionAuditItem {
  id: string
  created_at: string
  action: string
  actor_id: string | null
  entity_type: string | null
  entity_id: string | null
}

export interface TransactionDetail extends TransactionListItem {
  events: TransactionEventItem[]
  ledger: LedgerLine[]
  commission: CommissionSnapshot | null
  audit: TransactionAuditItem[]
}
