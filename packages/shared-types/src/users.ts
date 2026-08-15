/**
 * The Users module contract, docs/04_API_CONTRACT.md section 8.2.
 *
 * Rates are integer basis points, never a percentage. There is no money on this module,
 * so no field here ends `_minor`.
 */

import type { BankingScope, MenuGrant } from './auth'
import type { OperationalState, RateKind, UserRole, UserStatus } from './domain'

export interface AdminRate {
  rate_kind: RateKind
  rate_bp: number
  basis: string
  effective_from: string
}

/** A row in the user list, docs/03_MODULES_AND_SCREENS.md section 4.4. */
export interface UserListItem {
  id: string
  /** The per-tenant sequential number the list shows, never a foreign key. */
  display_seq: number | null
  username: string
  display_name: string
  role: UserRole
  supervisor_admin_id: string | null
  supervisor_username: string | null
  email: string | null
  mobile: string | null
  user_code: string | null
  status: UserStatus
  operational_state: OperationalState
  auto_accept_enabled: boolean
  two_fa_enabled: boolean
  /** True while the user has never set their own password. Derived from `password_changed_at`. */
  require_password_change: boolean
  menus: MenuGrant[]
  /**
   * ACTIVE banking grant rows this user holds. An Admin's effective scope also includes
   * the accounts they own, which arrives with banking in build step 4.
   */
  scope_grant_count: number
  last_login_at: string | null
  created_at: string
}

export interface UserDetail extends UserListItem {
  /** The granted ids. An Operator's effective scope is this intersected with their Admin's. */
  scope: BankingScope
  /** Both open kinds for an Admin, empty for every other role. */
  rates: AdminRate[]
}

export interface RevokedSessions {
  revoked: number
}
