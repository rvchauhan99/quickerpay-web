/**
 * SafePay247 Gateway API contract, docs/04_API_CONTRACT.md section 8.12 and
 * docs/integrations/safepay247-gateway/SAFEPAY247_GATEWAY_API.md.
 * Panel-facing bodies, responses and webhooks carry `amount` in whole rupees
 * (FastTag parity, docs/integrations/safepay247-gateway/FASTTAG_PARITY.md).
 * The public hosted-page views stay `_minor` paise for the web console formatter.
 */

import type { PayinPaymentMethod, PayinStatus, PaymentMethod, PayoutStatus } from './domain'

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

/** Player-facing names for `GET /gateway/payment-methods` items. */
export const GATEWAY_PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  MANUAL_BANK: 'Manual bank transfer',
  USDT_TRC20: 'USDT (TRC20)',
}

export interface GatewayPaymentMethodItem {
  payment_method: PaymentMethod
  label: string
}

/** `GET /gateway/payment-methods`: at most one item per kind, in `PAYMENT_METHODS` order; may be empty. */
export interface GatewayPaymentMethodsList {
  items: GatewayPaymentMethodItem[]
}

export const GATEWAY_WEBHOOK_EVENTS = [
  'payin.created',
  'payin.utr_submitted',
  'payin.completed',
  'payin.rejected',
  'payin.expired',
  'payout.created',
  'payout.confirmed',
  'payout.expired',
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
  /** Whole rupees. */
  amount: number
  status: PayinStatus
  /**
   * Collection method. Omitted on create → `PENDING_METHOD` until the player picks on the hosted page.
   * Compat: panel may still send UPI / MANUAL_BANK / USDT_TRC20 at create.
   */
  payment_method: PayinPaymentMethod
  /** Method-specific pay-to details for the player; empty while PENDING_METHOD. */
  pay_instructions: GatewayPayInstructions
  /** Filled when payment_method is UPI; null otherwise (prefer pay_instructions). */
  upi: string | null
  reference_number: string | null
  customer_ref: string | null
  note: string | null
  reason: string | null
  /** Hosted deposit page `{QP_GATEWAY_PAY_ORIGIN}/payin/{token}`; null in webhooks. */
  redirect_url: string | null
  /** Where the hosted page sends the player when done; echoed from create. */
  return_url: string | null
  /** Short-lived signed URL of the player's payment screenshot, or null. */
  image: string | null
  /** Set only while status is INITIATE (unpaid session clock). Null after IN_PROCESS or terminal. */
  expires_at: string | null
  created_at: string
  updated_at: string
}

/** A Gateway pay-out also reads `EXPIRED` when nobody confirmed it in time. */
export type GatewayPayoutStatus = PayoutStatus | 'EXPIRED'

/** What the panel receives for a pay-out (API response and webhook `data`). */
export interface GatewayPayout {
  id: string
  /** Null until the Exchange Master confirms the pay-out on the hosted page. */
  transaction_number: string | null
  merchant_order_id: string
  /** Whole rupees. */
  amount: number
  status: GatewayPayoutStatus
  /** Hosted confirm page `{QP_GATEWAY_PAY_ORIGIN}/payout/{token}` while awaiting confirm; else null. */
  redirect_url: string | null
  return_url: string | null
  /** End of the confirm window. */
  expires_at: string | null
  confirmed_at: string | null
  beneficiary_name: string
  beneficiary_account_masked: string | null
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
  payment_method: PayinPaymentMethod
  pay_instructions: GatewayPayInstructions
  upi: string | null
  payee_name: string
  status: PayinStatus
  /** UPI UTR or USDT TxID is pinned. */
  utr_submitted: boolean
  /** A payment screenshot is on file. */
  proof_submitted: boolean
  expires_at: string | null
  return_url: string | null
  /** Present while PENDING_METHOD — kinds the player may pick (allocator eligibility). */
  available_methods?: GatewayPaymentMethodItem[]
}

export type GatewayPayoutPageStatus = 'AWAITING_CONFIRM' | 'LOCKED' | 'CONFIRMED' | 'EXPIRED'

/**
 * Public hosted pay-out confirm page view.
 * Full `beneficiary_account` is returned here (token is the bearer); Gateway REST create/list stay masked.
 */
export interface GatewayPayoutPageView {
  merchant_order_id: string
  amount_minor: number
  payee_name: string
  beneficiary_name: string
  /** Full account digits for operator verify before TOTP. Null for UPI-only holds. */
  beneficiary_account: string | null
  beneficiary_account_masked: string | null
  beneficiary_ifsc: string | null
  beneficiary_bank_name: string | null
  beneficiary_upi: string | null
  status: GatewayPayoutPageStatus
  attempts_left: number
  transaction_number: string | null
  expires_at: string
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
  payout_confirm_seconds: number
  /** True once a pay-out authenticator has been issued. The secret is on GET .../authenticator, not here. */
  payout_authenticator_issued: boolean
  status: 'ACTIVE' | 'DISABLED' | null
  keys: GatewayApiKeyItem[]
  base_url_path: string
}

/** Returned once on enable / key create / key rotate / secret regenerate. */
export interface GatewaySecretReveal {
  api_key?: string
  key?: GatewayApiKeyItem
  webhook_secret?: string
  /** Pay-out authenticator. Super Admin can open it again from GET .../authenticator. */
  payout_totp_otpauth_uri?: string
  payout_totp_secret?: string
  payout_totp_qr_data_url?: string
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
  /** Frozen outbound webhook body `{ id, event, created_at, timestamp, data }`. Signing headers are not included. */
  payload: Record<string, unknown>
}
