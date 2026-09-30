import type { UserRole } from '@quickerpay/shared-types'

/**
 * Display labels. Storage/API codes are SUPER_ADMIN | ADMIN | BANKER | OPERATOR | AUDITOR | MERCHANT.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  /** Super Admin helper — menus only. */
  ADMIN: 'Admin',
  /** Banking owner. */
  BANKER: 'Banker',
  OPERATOR: 'Operator',
  AUDITOR: 'Auditor',
  /** Exchange Master portal login. */
  MERCHANT: 'Exchange Master',
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return ''
  if (role in ROLE_LABELS) return ROLE_LABELS[role as UserRole]
  return role.replaceAll('_', ' ')
}

/** Paying customer entity — API path `/merchants` unchanged. */
export function merchantLabel(opts?: { plural?: boolean }): string {
  return opts?.plural ? 'Exchange Masters' : 'Exchange Master'
}

/** Banking owner filter / column. */
export function bankerLabel(opts?: { plural?: boolean }): string {
  return opts?.plural ? 'Bankers' : 'Banker'
}
