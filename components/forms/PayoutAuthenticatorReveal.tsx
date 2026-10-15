'use client'

import type { GatewaySecretReveal } from '@quickerpay/shared-types'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { CopyButton } from '@/components/ui/CopyButton'

/**
 * The Exchange Master's pay-out authenticator, shown once next to the API key. Their staff
 * scan it into Google Authenticator and type its 6-digit code on the hosted pay-out page.
 */
export function PayoutAuthenticatorReveal({ reveal }: { reveal: GatewaySecretReveal }) {
  if (!reveal.payout_totp_otpauth_uri) return null
  return (
    <div className="mt-3 rounded-qp-card border p-3" style={{ borderColor: 'var(--qp-border)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
        Pay-out authenticator
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        Give this QR to the exchange. Their staff scan it with Google Authenticator and enter its 6-digit code on the
        SafePay247 pay-out page to release each withdrawal.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        {reveal.payout_totp_qr_data_url ? (
          <img
            src={reveal.payout_totp_qr_data_url}
            alt="Pay-out authenticator QR"
            className="h-[180px] w-[180px] rounded border"
            style={{ borderColor: 'var(--qp-border)' }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {reveal.payout_totp_secret ? (
            <FormField label="Setup key (manual entry)">
              <div className="flex items-center gap-1">
                <Input value={reveal.payout_totp_secret} readOnly className="font-mono" aria-label="Authenticator setup key" />
                <CopyButton value={reveal.payout_totp_secret} label="Copy setup key" successMessage="Copied setup key" />
              </div>
            </FormField>
          ) : null}
          <div className="mt-2">
            <FormField label="otpauth URI">
              <div className="flex items-center gap-1">
                <Input value={reveal.payout_totp_otpauth_uri} readOnly className="font-mono" aria-label="Authenticator URI" />
                <CopyButton value={reveal.payout_totp_otpauth_uri} label="Copy authenticator URI" successMessage="Copied URI" />
              </div>
            </FormField>
          </div>
        </div>
      </div>
    </div>
  )
}
