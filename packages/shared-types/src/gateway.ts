/**
 * SafePay247 Gateway API contract, docs/04_API_CONTRACT.md section 8.12 and
 * docs/integrations/safepay247-gateway/SAFEPAY247_GATEWAY_API.md.
 * Money is integer paise named `_minor`.
 */

import type { PayinStatus, PaymentMethod, PayoutStatus } from './domain'

/** Pay-to instructions returned on gateway create / status (method-specific). */
export interface GatewayPayInstructions {
  upi?: string
  account_holder_name?: string
  account_number?: string
  ifsc?: string
  bank_name?: string | null
  network?: 'TRC20'
  address?: string
  /** CRM transaction reference; shown for USDT so the player/support can match the pay-in. */
  deposit_ref?: string
}

export const GATEWAY_WEBHOOK_EVENTS = [
  'payin.created',
  'payin.utr_submitted',
  'payin.completed',
  'payin.rejected',
  'payin.expired',
  'payout.created',
  'payout.completed',
  'payout.rejected',
  'webhook.test',
] as const
export type GatewayWebhookEvent = (typeof GATEWAY_WEBHOOK_EVENTS)[number]

export type GatewayDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED'

/** What the panel receives for a pay-in (API response and webhook `data`). */
export interface GatewayPayin {
  id: string
  transaction_number: string
  merchant_order_id: string
  amount_minor: number
  status: PayinStatus
  /** Required on create; echoed on status. */
  payment_method: PaymentMethod
  /** Method-specific pay-to details for the player. */
  pay_instructions: GatewayPayInstructions
  /** Filled when payment_method is UPI; null otherwise (prefer pay_instructions). */
  upi: string | null
  reference_number: string | null
  customer_ref: string | null
  note: string | null
  reason: string | null
  redirect_url: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

/** What the panel receives for a pay-out (API response and webhook `data`). */
export interface GatewayPayout {
  id: string
  transaction_number: string
  merchant_order_id: string
  amount_minor: number
  status: PayoutStatus
  beneficiary_name: string
  beneficiary_account_masked: string
  beneficiary_ifsc: string | null
  beneficiary_bank_name: string | null
  beneficiary_upi: string | null
  reference_number: string | null
  customer_ref: string | null
  note: string | null
  reason: string | null
  proof_url: string | null
  created_at: string
  updated_at: string
}

/** Public hosted pay page view. No merchant or Banker identity is exposed. */
export interface GatewayPayPageView {
  transaction_number: string
  amount_minor: number
  payment_method: PaymentMethod
  pay_instructions: GatewayPayInstructions
  upi: string | null
  payee_name: string
  status: PayinStatus
  utr_submitted: boolean
  expires_at: string | null
  return_url: string | null
}

export interface GatewayApiKeyItem {
  id: string
  key_prefix: string
  label: string
  status: 'ACTIVE' | 'REVOKED'
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

export interface GatewayConfigView {
  merchant_id: string
  enabled: boolean
  integration_type: 'NONE' | 'SUPAGO' | 'CRICI' | 'API'
  webhook_url: string | null
  ip_allowlist: string[]
  return_url_hosts: string[]
  payin_expiry_seconds: number
  status: 'ACTIVE' | 'DISABLED' | null
  keys: GatewayApiKeyItem[]
  base_url_path: string
}

/** Returned once on enable / key create / key rotate / secret regenerate. */
export interface GatewaySecretReveal {
  api_key?: string
  key?: GatewayApiKeyItem
  webhook_secret?: string
}

export interface GatewayDeliveryItem {
  id: string
  event: GatewayWebhookEvent
  entity_type: 'payin' | 'payout' | 'test'
  entity_id: string
  status: GatewayDeliveryStatus
  attempts: number
  last_http_status: number | null
  last_error: string | null
  next_attempt_at: string | null
  delivered_at: string | null
  created_at: string
}
