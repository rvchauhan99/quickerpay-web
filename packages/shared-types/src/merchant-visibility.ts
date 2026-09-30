/**
 * Exchange Master (merchant) catalog identity is Super Admin + Admin only.
 * Banker / Operator / Auditor / MERCHANT must not list or filter the catalog.
 * MERCHANT may still see own panel usernames via canSeeOwnPanelUsernames.
 */
import type { UserRole } from './domain'

export function canSeeMerchants(role: UserRole | string | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

/** Panel party usernames on own txn rows: SA, Admin, and Merchant portal. */
export function canSeeOwnPanelUsernames(role: UserRole | string | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MERCHANT'
}
