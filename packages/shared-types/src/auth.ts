/**
 * The login and session contract from docs/04_API_CONTRACT.md section 2.
 *
 * `menus` and `scope` travel to the browser for navigation only. The server
 * re-reads both from the database on every request, so nothing here is
 * authorization. Non-negotiable 3.
 */

import type { MenuActions, MenuCode, OperationalState, UserRole } from './domain'

export const MENU_ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_approve', 'can_export'] as const
export type MenuAction = (typeof MENU_ACTIONS)[number]

/** Actions that change state, and so are refused on a non-writable Tenant. */
export const WRITE_MENU_ACTIONS = ['can_create', 'can_edit', 'can_approve'] as const

/** Control-plane roles, from docs/02_DATA_MODEL.md section 3.4. Never present in a tenant database. */
export const PLATFORM_ROLES = ['PLATFORM_OWNER', 'PLATFORM_SUPPORT', 'PLATFORM_AUDITOR'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/** Roles that cannot log in without a second factor, per docs/04_API_CONTRACT.md section 2.1. */
export const ROLES_REQUIRING_TWO_FACTOR = ['SUPER_ADMIN'] as const satisfies readonly UserRole[]
export const PLATFORM_ROLES_REQUIRING_TWO_FACTOR = [
  'PLATFORM_OWNER',
] as const satisfies readonly PlatformRole[]

export interface MenuGrant extends MenuActions {
  menu_code: MenuCode
}

export interface BankingScope {
  bank_account_ids: string[]
  upi_account_ids: string[]
}

/**
 * The fields docs/04_API_CONTRACT.md section 2.1 puts in the login response, plus
 * `auto_accept_enabled`, which the header's Auto Accept switch reads and which is a
 * column on `users` rather than a client preference. docs/03 section 2.1.1.
 */
export interface SessionUser {
  id: string
  username: string
  display_name: string
  role: UserRole
  supervisor_admin_id: string | null
  operational_state: OperationalState
  auto_accept_enabled: boolean
}

export interface SessionTenant {
  id: string
  slug: string
  display_name: string
}

export interface LoginResponse {
  access_token: string
  expires_in: number
  user: SessionUser
  tenant: SessionTenant
  menus: MenuGrant[]
  scope: BankingScope
}

export interface PlatformUserSummary {
  id: string
  email: string
  name: string
  role: PlatformRole
}

export interface PlatformLoginResponse {
  access_token: string
  expires_in: number
  user: PlatformUserSummary
}
