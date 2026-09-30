/**
 * Exchange Master (merchant) identity is Super Admin + Admin only.
 * Banker / Operator / Auditor must not list, filter, or receive merchant fields.
 */
import type { UserRole } from './domain'

export function canSeeMerchants(role: UserRole | string | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}
