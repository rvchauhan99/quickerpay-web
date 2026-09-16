export interface CriciBankListItem {
  id: string
  merchant_id: string
  merchant_code: string
  merchant_name: string
  crici_billing_method_id: string
  display_name: string
  upi_address: string
  min_rupees: number
  max_rupees: number
  active: boolean
  bank_account_id: string | null
  linked_upi_address: string | null
  owner_user_id: string | null
  owner_username: string | null
  synced_at: string
}

export interface CriciBankResyncResult {
  merchants_synced: number
  rows_upserted: number
  rows_linked: number
  rows_owner_assigned: number
  rows_status_synced: number
  errors: Array<{ merchant_id: string; message: string }>
}

export interface CriciConnectionStatus {
  connected: boolean
  /** True when username/password are registered in-memory (and typically persisted). */
  credentials_stored?: boolean | undefined
  /** Session is down; Super Admin should reconnect (especially after Google 2FA). */
  needs_reconnect?: boolean | undefined
  /** Last failure was a Google Authenticator challenge; password-only heal cannot succeed. */
  requires_2fa?: boolean | undefined
  username?: string | undefined
  expires_at?: string | undefined
  last_error?: string | undefined
}

export interface CriciConnectionAlertItem {
  merchant_id: string
  merchant_code: string
  merchant_name: string
  last_error?: string | undefined
  requires_2fa: boolean
  needs_reconnect: boolean
}
