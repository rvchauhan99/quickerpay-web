'use client'

import { fromMinor } from '@quickerpay/money'
import type { PayoutListItem } from '@quickerpay/shared-types'

/** Amount string for UPI `am=` (rupees with two decimals, no grouping). */
export function payoutAmountForUpi(amountMinor: number): string {
  return fromMinor(BigInt(amountMinor)).replace(/^₹-?/, '').replace(/,/g, '')
}

/** Build a UPI intent URL for QR / deep link. */
export function buildPayoutUpiIntent(row: PayoutListItem): string | null {
  const pa = row.beneficiary_upi?.trim()
  if (!pa) return null
  const params = new URLSearchParams()
  params.set('pa', pa)
  params.set('am', payoutAmountForUpi(row.amount_minor))
  params.set('cu', 'INR')
  const pn = row.beneficiary_name?.trim()
  if (pn) params.set('pn', pn)
  const tn = row.merchant_order_id?.trim() || row.reference?.trim()
  if (tn) params.set('tn', tn.slice(0, 50))
  return `upi://pay?${params.toString()}`
}
