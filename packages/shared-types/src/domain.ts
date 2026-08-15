/**
 * Domain unions mirroring the CHECK constraints in docs/02_DATA_MODEL.md.
 *
 * A value added here must be added to the matching CHECK constraint and state
 * machine in the same pull request, per docs/05_RULES_AND_ACCEPTANCE.md section 7.
 */

export const TENANT_STATUSES = [
  'PROVISIONING',
  'PROVISIONING_FAILED',
  'ACTIVE',
  'SUSPENDED',
  'DEGRADED',
  'READ_ONLY',
  'OFFBOARDING',
  'ARCHIVED',
] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

/** Tenant statuses that may serve a normal request. */
export const READABLE_TENANT_STATUSES = ['ACTIVE', 'READ_ONLY', 'DEGRADED'] as const

/** Tenant statuses that may create new financial operations. Non-negotiable 12. */
export const WRITABLE_TENANT_STATUSES = ['ACTIVE'] as const

export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'AUDITOR'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['ACTIVE', 'DISABLED', 'SUSPENDED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const OPERATIONAL_STATES = ['OFFLINE', 'ONLINE', 'BUSY', 'SUSPENDED'] as const
export type OperationalState = (typeof OPERATIONAL_STATES)[number]

export const MENU_CODES = [
  'DASHBOARD',
  'USERS',
  'MERCHANTS',
  'BANKS',
  'UPI',
  'PAYIN',
  'PAYOUT',
  'UTR',
  'TRANSACTIONS',
  'INTER_TRANSFER',
  'LEDGER',
  'COMMISSION',
  'REPORTS',
  'AUDIT',
  'SETTINGS',
  'SUPPORT',
] as const
export type MenuCode = (typeof MENU_CODES)[number]

export interface MenuActions {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_approve: boolean
  can_export: boolean
}

/** The eight-item Admin sidebar for Phase 1, per docs/03_MODULES_AND_SCREENS.md section 2.1.1. */
export const PHASE_1_ADMIN_MENUS = [
  'DASHBOARD',
  'USERS',
  'BANKS',
  'LEDGER',
  'PAYIN',
  'PAYOUT',
  'UTR',
  'INTER_TRANSFER',
] as const satisfies readonly MenuCode[]

/** Commission is charged per kind at independent rates. Decision D9. */
export const RATE_KINDS = ['PAYIN', 'PAYOUT'] as const
export type RateKind = (typeof RATE_KINDS)[number]

export const TRANSACTION_TYPES = [
  'PAYIN',
  'PAYOUT',
  'INTER_TRANSFER',
  'ADJUSTMENT',
  'REFUND',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const PAYIN_STATUSES = [
  'INITIATE',
  'IN_PROCESS',
  'COMPLETED',
  'REJECTED',
  'REFUND',
] as const
export type PayinStatus = (typeof PAYIN_STATUSES)[number]

export const PAYOUT_STATUSES = [
  'INITIATE',
  'IN_PROCESS',
  'COMPLETED',
  'REJECTED',
  'REFUND',
] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export const TRANSFER_TYPES = [
  'ADMIN_TO_ADMIN',
  'ADMIN_TO_SUPER_ADMIN',
  'SUPER_ADMIN_TO_ADMIN',
  'SELF_TRANSFER',
] as const
export type TransferType = (typeof TRANSFER_TYPES)[number]

export const INTER_TRANSFER_STATUSES = [
  'CREATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
] as const
export type InterTransferStatus = (typeof INTER_TRANSFER_STATUSES)[number]

export const MERCHANT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]

/** Reference prefixes per type, from docs/03_MODULES_AND_SCREENS.md section 4.20. */
export const REFERENCE_PREFIX = {
  PAYIN: 'TXN',
  PAYOUT: 'PRT',
  INTER_TRANSFER: 'HAW',
  ADJUSTMENT: 'ADJ',
  REFUND: 'REF',
} as const satisfies Record<TransactionType, string>

export const UTR_SOURCES = ['MANUAL', 'EXTENSION', 'API'] as const
export type UtrSource = (typeof UTR_SOURCES)[number]

export const UTR_STATUSES = [
  'PENDING',
  'COMPLETED',
  'DELETED',
] as const
export type UtrStatus = (typeof UTR_STATUSES)[number]

export const BANKING_STATUSES = [
  'PENDING_APPROVAL',
  'ACTIVE',
  'DISABLED',
  'REJECTED',
  'CLOSED',
] as const
export type BankingStatus = (typeof BANKING_STATUSES)[number]

/** Banking statuses eligible for routing, assignment, pay-out source or transfer. Rule R11. */
export const TRANSACTABLE_BANKING_STATUSES = ['ACTIVE'] as const

export const BANK_ACCOUNT_TYPES = ['CURRENT', 'SAVINGS', 'OTHER'] as const
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number]

export const BANK_PURPOSES = ['COLLECTION', 'DISTRIBUTION', 'BOTH'] as const
export type BankPurpose = (typeof BANK_PURPOSES)[number]

export const LEDGER_DIRECTIONS = ['DEBIT', 'CREDIT'] as const
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number]

export const DEPLOYMENT_MODES = ['MULTI_TENANT', 'SINGLE_TENANT'] as const
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number]
