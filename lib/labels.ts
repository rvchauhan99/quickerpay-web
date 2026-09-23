import type { UserRole } from '@quickerpay/shared-types'

/**
 * Display labels only. API/DB codes stay SUPER_ADMIN | ADMIN | STAFF_ADMIN | …
 * Frontend always shows these strings regardless of backend spelling.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  /** Banking owner — stored as ADMIN. */
  ADMIN: 'Banker',
  /** Super Admin helper — stored as STAFF_ADMIN. Always display "Admin". */
  STAFF_ADMIN: 'Admin',
  OPERATOR: 'Operator',
  AUDITOR: 'Auditor',
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

/** Banking owner filter / column (API role ADMIN). */
export function bankerLabel(opts?: { plural?: boolean }): string {
  return opts?.plural ? 'Bankers' : 'Banker'
}
