export interface ExtensionTenantPickerItem {
  slug: string
  display_name: string
}

export interface ExtensionTenantPickerResponse {
  deployment_mode: 'SINGLE_TENANT' | 'MULTI_TENANT'
  tenants: ExtensionTenantPickerItem[]
}

export interface ExtensionDeviceListItem {
  id: string
  label: string
  token_prefix: string
  status: string
  presence: 'Online' | 'Offline'
  admin_name: string
  admin_username: string
  upi_address: string
  last_seen_at: string | null
  scraper_version: string | null
  rows_seen: number
  entries_posted: number
  enrolled_by: string
  created_at: string
}
