/**
 * Banking module contract, docs/04_API_CONTRACT.md section 8.4.
 *
 * List responses carry `_masked` fields only. The full account number is a reveal call.
 * Money is integer paise named `_minor`.
 */

import type { BankAccountType, BankingStatus, BankPurpose, UserRole } from './domain'

export interface BankAccountListItem {
  id: string
  owner_user_id: string
  owner_username: string
  owner_display_name: string
  owner_role: UserRole
  label: string
  bank_name: string | null
  account_holder: string | null
  account_number_masked: string | null
  ifsc_masked: string | null
  account_type: BankAccountType
  purpose: BankPurpose
  currency: string
  status: BankingStatus
  daily_credit_limit_minor: number | null
  daily_debit_limit_minor: number | null
  per_txn_limit_minor: number | null
  created_at: string
  approved_at: string | null
  upi_address: string | null
  /** True when bank_accounts.supago_payment_method_id is set. */
  supago_linked: boolean
  supago_payment_method_id: number | null
  /** Supago Update form fields (deposit min/max are whole rupees, not paise). */
  supago_description: string | null
  supago_remark: string | null
  /** Whole rupees on Supago, not QuickerPay `_minor` paise. */
  supago_minval: number | null
  /** Whole rupees on Supago, not QuickerPay `_minor` paise. */
  supago_maxval: number | null
  supago_regex_pattern: string | null
}

export interface BankAccountDetail extends BankAccountListItem {
  /** Present only after an audited reveal. Never included in a list. */
  account_number?: string
  ifsc?: string
}

export interface UpiAccountListItem {
  id: string
  bank_account_id: string
  bank_label: string
  owner_user_id: string
  owner_username: string
  owner_display_name: string
  upi_address: string
  display_name: string
  status: BankingStatus
  auto_accept: boolean
  daily_limit_minor: number | null
  per_txn_limit_minor: number | null
  /** Zero until the ledger exists. Named so the screen can bind it now. */
  today_volume_minor: number
  created_at: string
}

export interface UpiStatusHistoryItem {
  id: string
  from_status: BankingStatus | null
  to_status: BankingStatus
  reason: string | null
  changed_by: string
  created_at: string
}

export interface RevealedAccountNumber {
  account_number: string
  ifsc: string | null
}

/** Per-merchant link status for one CRM bank (Bank Details merchant panel). */
export interface BankMerchantLink {
  merchant_id: string
  merchant_display_name: string
  status: 'ACTIVE' | 'DISABLED'
  /** False when the bank owner Admin is not on this merchant's Deposit Managed By allowlist. */
  allowed: boolean
  /** Panel used for this merchant link. */
  integration_type: 'SUPAGO' | 'CRICI'
  supago_linked: boolean
  supago_payment_method_id: number | null
  crici_linked: boolean
  crici_billing_method_id: string | null
}

/** Merchants the bank owner may provision on Create (Deposit Managed By + panel credentials). */
export interface EligibleBankMerchant {
  id: string
  display_name: string
  integration_type: 'SUPAGO' | 'CRICI'
}
