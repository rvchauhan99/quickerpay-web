'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GatewayPayoutPageView } from '@quickerpay/shared-types'
import { BrandLockup } from '@/components/brand/BrandLockup'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { ErrorAlert, PrimaryButton } from '@/components/ui/PageHeader'
import { MoneyDisplay } from '@/lib/money'

const REDIRECT_AFTER_MS = 4_000
const CODE_PATTERN = /^\d{6}$/

type LoadState = 'loading' | 'ready' | 'missing' | 'error'

interface Envelope<T> {
  success: boolean
  data?: T
  message?: string
}

/** The confirm page has no session, so it calls the public endpoint with plain fetch. */
async function fetchView(token: string): Promise<{ status: number; view: GatewayPayoutPageView | null }> {
  const response = await fetch(`/api/v1/gateway/payout-page/${encodeURIComponent(token)}`, { cache: 'no-store' })
  const body = (await response.json().catch(() => ({}))) as Envelope<GatewayPayoutPageView>
  return { status: response.status, view: body.data ?? null }
}

function remainingLabel(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        {label}
      </dt>
      <dd className="text-right font-mono text-sm" style={{ color: 'var(--qp-text-primary)' }}>
        {value}
      </dd>
    </div>
  )
}

export function HostedPayoutPage({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [view, setView] = useState<GatewayPayoutPageView | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchView(token)
      if (result.status === 404) {
        setState('missing')
        return
      }
      if (!result.view) {
        setState('error')
        return
      }
      setView(result.view)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const awaiting = view?.status === 'AWAITING_CONFIRM'
  const remaining = view && awaiting ? remainingLabel(view.expires_at, now) : null
  const expired = view?.status === 'EXPIRED' || remaining === '00:00'

  useEffect(() => {
    if (!awaiting) return
    const tick = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(tick)
  }, [awaiting])

  useEffect(() => {
    if (view?.status !== 'CONFIRMED' || !view.return_url) return
    const timer = window.setTimeout(() => window.location.assign(view.return_url!), REDIRECT_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [view?.status, view?.return_url])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!CODE_PATTERN.test(code)) {
      setSubmitError('Enter the 6-digit code from your authenticator app')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch(`/api/v1/gateway/payout-page/${encodeURIComponent(token)}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const body = (await response.json().catch(() => ({}))) as Envelope<GatewayPayoutPageView>
      if (!response.ok || !body.data) {
        setSubmitError(body.message ?? 'Could not confirm. Try again.')
        setCode('')
        void load()
        return
      }
      setView(body.data)
    } catch {
      setSubmitError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center">
      <div
        className="w-full max-w-md rounded-qp-card border p-5"
        style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <BrandLockup size="md" tone="light" subtitle="Confirm pay-out" />
        </div>

        {state === 'loading' ? (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--qp-text-muted)' }}>
            Loading pay-out…
          </p>
        ) : null}

        {state === 'missing' ? (
          <div className="py-8 text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              Pay-out link not found
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--qp-text-muted)' }}>
              Check the link or create the withdrawal again from the exchange.
            </p>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="py-6">
            <ErrorAlert message="Could not load this pay-out. Check your connection and retry." />
            <div className="mt-3 flex justify-center">
              <PrimaryButton onClick={() => void load()}>Retry</PrimaryButton>
            </div>
          </div>
        ) : null}

        {state === 'ready' && view ? (
          <>
            <div className="mb-4 text-center">
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--qp-text-muted)' }}>
                Pay-out amount
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--qp-text-primary)' }}>
                <MoneyDisplay amountMinor={view.amount_minor} />
              </p>
              <p className="mt-1 font-mono text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                {view.transaction_number ?? view.merchant_order_id}
              </p>
            </div>

            <dl className="mb-4 rounded-qp-card border px-3 py-2" style={{ borderColor: 'var(--qp-border)' }}>
              <Row label="Account holder" value={view.beneficiary_name} />
              <Row label="Account number" value={view.beneficiary_account ?? view.beneficiary_account_masked} />
              <Row label="IFSC" value={view.beneficiary_ifsc} />
              <Row label="Bank" value={view.beneficiary_bank_name} />
              <Row label="UPI" value={view.beneficiary_upi} />
              <Row label="Exchange" value={view.payee_name} />
            </dl>

            {view.status === 'CONFIRMED' ? (
              <ErrorAlert type="success" message="Pay-out confirmed. It is now in the SafePay247 pay-out queue." />
            ) : null}

            {view.status === 'LOCKED' ? (
              <ErrorAlert message="Too many wrong codes. This pay-out is locked; create a new withdrawal from the exchange." />
            ) : null}

            {awaiting && expired ? (
              <ErrorAlert message="This pay-out link has expired. Create a new withdrawal from the exchange." />
            ) : null}
            {view.status === 'EXPIRED' ? (
              <ErrorAlert message="This pay-out link has expired. Create a new withdrawal from the exchange." />
            ) : null}

            {awaiting && !expired ? (
              <form className="flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
                {remaining ? (
                  <p className="text-center text-sm" style={{ color: 'var(--qp-text-secondary)' }}>
                    Confirm within <span className="font-semibold tabular-nums">{remaining}</span>
                  </p>
                ) : null}
                <FormField
                  label="Authenticator code"
                  required
                  htmlFor="payout-code"
                  error={submitError}
                  hint={`From the SafePay247 pay-out authenticator. ${view.attempts_left} attempts left.`}
                >
                  <Input
                    id="payout-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6 digit code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    aria-label="Authenticator code"
                  />
                </FormField>
                <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                  Confirm pay-out
                </PrimaryButton>
              </form>
            ) : null}

            {view.status !== 'AWAITING_CONFIRM' && view.return_url ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                {view.status === 'CONFIRMED' ? (
                  <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                    Returning to the exchange in a few seconds…
                  </p>
                ) : null}
                <PrimaryButton href={view.return_url}>Return to exchange</PrimaryButton>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}
