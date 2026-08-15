/**
 * UTR entries contract, docs/04_API_CONTRACT.md section 8.7.
 * Money is integer paise named `_minor`.
 */

import type { UtrSource, UtrStatus } from './domain'

export interface UtrListItem {
  id: string
  utr: string
  amount_minor: number
  upi_account_id: string | null
  upi_address: string | null
  transaction_id: string | null
  reference: string | null
  status: UtrStatus
  source: UtrSource
  added_by: string | null
  added_by_username: string | null
  extension_device_id: string | null
  device_label: string | null
  entry_time: string
  action_time: string | null
}
