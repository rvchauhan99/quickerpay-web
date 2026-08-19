export interface SupagoBankListItem {
  id: string
  merchant_id: string
  merchant_code: string
  merchant_name: string
  supago_payment_method_id: number
  display_name: string
  upi_address: string
  pname: string
  ptype: string
  active: boolean
  bank_account_id: string | null
  linked_upi_address: string | null
  owner_user_id: string | null
  owner_username: string | null
  synced_at: string
}

export interface SupagoBankResyncResult {
  merchants_synced: number
  rows_upserted: number
  rows_linked: number
  rows_owner_assigned: number
  rows_status_synced: number
  errors: Array<{ merchant_id: string; message: string }>
}
