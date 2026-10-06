/**
 * Role menu ceilings shared by API and Web.
 * A grant may only narrow these; docs/01_BUSINESS_MODEL.md section 2.
 */

import type { MenuCode, UserRole } from './domain'
import { MENU_CODES } from './domain'
import { MENU_ACTIONS, type MenuAction } from './auth'
import type { MenuActions } from './domain'

const ALL_ACTIONS = MENU_ACTIONS
const VIEW_ONLY: readonly MenuAction[] = ['can_view']
const VIEW_EXPORT: readonly MenuAction[] = ['can_view', 'can_export']
const WORK: readonly MenuAction[] = ['can_view', 'can_create', 'can_edit']
const WORK_EXPORT: readonly MenuAction[] = ['can_view', 'can_create', 'can_edit', 'can_export']

type MenuCeiling = Partial<Record<MenuCode, readonly MenuAction[]>>

const SUPER_ADMIN_CEILING: MenuCeiling = Object.fromEntries(
  MENU_CODES.map((menu) => [menu, ALL_ACTIONS]),
)

const BANKER_CEILING: MenuCeiling = {
  DASHBOARD: VIEW_ONLY,
  USERS: WORK,
  BANKS: WORK,
  UPI: WORK,
  PAYIN: [...WORK_EXPORT, 'can_approve'],
  PAYOUT: WORK_EXPORT,
  UTR: WORK,
  TRANSACTIONS: VIEW_EXPORT,
  HAWALA: ['can_view', 'can_create'],
  PARTIES: VIEW_ONLY,
  LEDGER: VIEW_EXPORT,
  COMMISSION: VIEW_ONLY,
  REPORTS: VIEW_EXPORT,
  AUDIT: VIEW_ONLY,
  SUPPORT: VIEW_ONLY,
}

const ADMIN_CEILING: MenuCeiling = SUPER_ADMIN_CEILING

const OPERATOR_CEILING: MenuCeiling = {
  DASHBOARD: VIEW_ONLY,
  PAYIN: WORK,
  PAYOUT: WORK,
  UTR: WORK,
  TRANSACTIONS: VIEW_ONLY,
  LEDGER: VIEW_ONLY,
  AUDIT: VIEW_ONLY,
  SUPPORT: VIEW_ONLY,
}

const AUDITOR_CEILING: MenuCeiling = Object.fromEntries(
  MENU_CODES.filter((menu) => menu !== 'SETTINGS').map((menu) => [menu, VIEW_EXPORT]),
)

const MERCHANT_CEILING: MenuCeiling = {
  DASHBOARD: VIEW_ONLY,
  PAYIN: VIEW_ONLY,
  PAYOUT: VIEW_ONLY,
  TRANSACTIONS: VIEW_ONLY,
}

const CEILINGS: Record<UserRole, MenuCeiling> = {
  SUPER_ADMIN: SUPER_ADMIN_CEILING,
  ADMIN: ADMIN_CEILING,
  BANKER: BANKER_CEILING,
  OPERATOR: OPERATOR_CEILING,
  AUDITOR: AUDITOR_CEILING,
  MERCHANT: MERCHANT_CEILING,
}

const CREATABLE_ROLES: Record<UserRole, readonly UserRole[]> = {
  SUPER_ADMIN: ['BANKER', 'ADMIN', 'OPERATOR', 'AUDITOR'],
  BANKER: ['OPERATOR'],
  ADMIN: [],
  OPERATOR: [],
  AUDITOR: [],
  MERCHANT: [],
}

export function isTenantWideRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'AUDITOR' || role === 'ADMIN'
}

export const MERCHANT_PORTAL_MENUS: readonly MenuCode[] = [
  'DASHBOARD',
  'PAYIN',
  'PAYOUT',
  'TRANSACTIONS',
] as const

export function roleAllows(role: UserRole, menu: MenuCode, action: MenuAction): boolean {
  return CEILINGS[role][menu]?.includes(action) ?? false
}

export function rolesCreatableBy(role: UserRole): readonly UserRole[] {
  return CREATABLE_ROLES[role]
}

export function canCreateRole(creator: UserRole, target: UserRole): boolean {
  return CREATABLE_ROLES[creator].includes(target)
}

/** Menus a role may hold at all (for create-user forms). */
export function menusForRole(role: UserRole): MenuCode[] {
  return Object.keys(CEILINGS[role]) as MenuCode[]
}

/** Max flags the role ceiling allows for one menu. */
export function preferredGrantForMenu(role: UserRole, menu: MenuCode): MenuActions {
  return {
    can_view: roleAllows(role, menu, 'can_view'),
    can_create: roleAllows(role, menu, 'can_create'),
    can_edit: roleAllows(role, menu, 'can_edit'),
    can_approve: roleAllows(role, menu, 'can_approve'),
    can_export: roleAllows(role, menu, 'can_export'),
  }
}

/** Clamp desired flags to the role ceiling (and optionally to a grantor's held flags). */
export function clampMenuGrant(
  role: UserRole,
  menu: MenuCode,
  desired: Partial<MenuActions>,
  grantor?: Partial<MenuActions> | null,
): MenuActions {
  const ceiling = preferredGrantForMenu(role, menu)
  const g = grantor ?? null
  return {
    can_view: Boolean(desired.can_view) && ceiling.can_view && (g ? Boolean(g.can_view) : true),
    can_create: Boolean(desired.can_create) && ceiling.can_create && (g ? Boolean(g.can_create) : true),
    can_edit: Boolean(desired.can_edit) && ceiling.can_edit && (g ? Boolean(g.can_edit) : true),
    can_approve: Boolean(desired.can_approve) && ceiling.can_approve && (g ? Boolean(g.can_approve) : true),
    can_export: Boolean(desired.can_export) && ceiling.can_export && (g ? Boolean(g.can_export) : true),
  }
}
