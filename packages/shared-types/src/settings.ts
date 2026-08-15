/**
 * Tenant settings the Super Admin may view and change, docs/03 section 4.19.
 * Timezone and notification prefs have no columns yet and are not on this contract.
 */

export interface TenantSettingsView {
  require_banking_approval: boolean
  inter_transfer_approval_above_minor: number
  allow_negative_margin: boolean
}
