'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { GatewayPayPageView, PaymentMethod } from '@quickerpay/shared-types'
import { BrandLockup } from '@/components/brand/BrandLockup'
import { DocumentUpload } from '@/components/forms/DocumentUpload'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { CopyButton } from '@/components/ui/CopyButton'
import { ErrorAlert, PrimaryButton } from '@/components/ui/PageHeader'
import { MoneyDisplay } from '@/lib/money'
import { buildPayinUpiIntent } from '@/lib/payoutUpi'

const POLL_MS = 5_000
const REDIRECT_AFTER_MS = 5_000
const PROOF_MAX_BYTES = 5 * 1024 * 1024
const PROOF_ACCEPT = 'image/png,image/jpeg,image/webp'
const UTR_PATTERN = /^\d{12}$/
const TXID_PATTERN = /^[a-fA-F0-9]{64}$/

const SUBTITLE: Record<PaymentMethod, string> = {
  UPI: 'Secure UPI payment',
  MANUAL_BANK: 'Secure bank transfer',
  USDT_TRC20: 'Secure USDT (TRC20) payment',
}

type LoadState = 'loading' | 'ready' | 'missing' | 'error'

interface Envelope<T> {
  success: boolean
  data?: T
  message?: string
}

/** The pay page has no session, so it calls the public endpoint with plain fetch. */
async function fetchView(token: string): Promise<{ status: number; view: GatewayPayPageView | null; message: string | null }> {
  const response = await fetch(`/api/v1/gateway/pay/${encodeURIComponent(token)}`, { cache: 'no-store' })
  const body = (await response.json().catch(() => ({}))) as Envelope<GatewayPayPageView>
  return { status: response.status, view: body.data ?? null, message: body.message ?? null }
}

async function postForm(url: string, form: FormData): Promise<{ view: GatewayPayPageView | null; message: string | null }> {
  const response = await fetch(url, { method: 'POST', body: form })
  const body = (await response.json().catch(() => ({}))) as Envelope<GatewayPayPageView>
  if (!response.ok || !body.data) return { view: null, message: body.message ?? null }
  return { view: body.data, message: null }
}

function remainingLabel(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function useQr(value: string | null): string | null {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    if (!value) {
      setQr(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (!cancelled) setQr(url)
      },
      () => {
        if (!cancelled) setQr(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [value])
  return qr
}

function QrImage({ qr, alt }: { qr: string | null; alt: string }) {
  return qr ? (
    <img src={qr} alt={alt} className="h-[220px] w-[220px]" />
  ) : (
    <div className="flex h-[220px] w-[220px] items-center justify-center text-xs" style={{ color: 'var(--qp-text-muted)' }}>
      Generating QR…
    </div>
  )
}

function DetailRow({ label, value, copyLabel }: { label: string; value: string | null | undefined; copyLabel: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0" style={{ borderColor: 'var(--qp-border)' }}>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
          {label}
        </p>
        <p className="break-all font-mono text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
          {value}
        </p>
      </div>
      <CopyButton value={value} label={copyLabel} />
    </div>
  )
}

export function HostedPayPage({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [view, setView] = useState<GatewayPayPageView | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [reference, setReference] = useState('')
  const [proof, setProof] = useState<File | null>(null)
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

  const isTerminal = view?.status === 'COMPLETED' || view?.status === 'REJECTED'
  const method: PaymentMethod = view?.payment_method ?? 'UPI'

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (state !== 'ready' || isTerminal) return
    const poll = window.setInterval(() => void load(), POLL_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [isTerminal, load, state])

  useEffect(() => {
    if (!isTerminal || !view?.return_url) return
    const timer = window.setTimeout(() => window.location.assign(view.return_url!), REDIRECT_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [isTerminal, view?.return_url])

  const upiIntent = useMemo(
    () =>
      view && method === 'UPI'
        ? buildPayinUpiIntent({
            upi: view.upi,
            payeeName: view.payee_name,
            amountMinor: view.amount_minor,
            note: view.transaction_number,
          })
        : null,
    [method, view],
  )
  const usdtAddress = method === 'USDT_TRC20' ? (view?.pay_instructions.address ?? null) : null
  const qr = useQr(upiIntent ?? usdtAddress)

  const submit = async (send: () => Promise<{ view: GatewayPayPageView | null; message: string | null }>, fallback: string) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await send()
      if (!result.view) {
        setSubmitError(result.message ?? fallback)
        return
      }
      setView(result.view)
      setProof(null)
    } catch {
      setSubmitError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReference = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = reference.trim()
    if (method === 'USDT_TRC20' ? !TXID_PATTERN.test(value) : !UTR_PATTERN.test(value)) {
      setSubmitError(
        method === 'USDT_TRC20'
          ? 'Enter the 64 character transaction hash (TxID) from your wallet'
          : 'Enter the 12 digit UTR / reference number from your UPI app',
      )
      return
    }
    const form = new FormData()
    form.set('reference_number', value)
    if (proof) form.set('image', proof)
    await submit(
      () => postForm(`/api/v1/gateway/pay/${encodeURIComponent(token)}/utr`, form),
      'Could not submit the reference. Try again.',
    )
  }

  const handleAttachment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!proof) {
      setSubmitError('Choose the payment screenshot to upload')
      return
    }
    const form = new FormData()
    form.set('image', proof)
    await submit(
      () => postForm(`/api/v1/gateway/pay/${encodeURIComponent(token)}/attachment`, form),
      'Could not upload the screenshot. Try again.',
    )
  }

  const remaining = view && !isTerminal ? remainingLabel(view.expires_at, now) : null
  const expired = remaining === '00:00'
  const instructions = view?.pay_instructions ?? {}

  const proofField = (label: string) => (
    <FormField label={label}>
      <DocumentUpload
        value={proof}
        onChange={setProof}
        accept={PROOF_ACCEPT}
        maxBytes={PROOF_MAX_BYTES}
        aria-label="Payment screenshot"
      />
    </FormField>
  )

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center">
      <div
        className="w-full max-w-md rounded-qp-card border p-5"
        style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <BrandLockup size="md" tone="light" subtitle={SUBTITLE[method]} />
        </div>

        {state === 'loading' ? (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--qp-text-muted)' }}>
            Loading payment…
          </p>
        ) : null}

        {state === 'missing' ? (
          <div className="py-8 text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              Payment link not found
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--qp-text-muted)' }}>
              Check the link or start the payment again from the merchant.
            </p>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="py-6">
            <ErrorAlert message="Could not load this payment. Check your connection and retry." />
            <div className="mt-3 flex justify-center">
              <PrimaryButton onClick={() => void load()}>Retry</PrimaryButton>
            </div>
          </div>
        ) : null}

        {state === 'ready' && view ? (
          <>
            <div className="mb-4 text-center">
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--qp-text-muted)' }}>
                Amount to pay
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--qp-text-primary)' }}>
                <MoneyDisplay amountMinor={view.amount_minor} />
              </p>
              <p className="mt-1 font-mono text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                {view.transaction_number}
              </p>
            </div>

            {view.status === 'COMPLETED' ? (
              <div className="py-4 text-center">
                <ErrorAlert type="success" message="Payment received. Thank you." />
              </div>
            ) : null}

            {view.status === 'REJECTED' ? (
              <div className="py-4 text-center">
                <ErrorAlert message="This payment was not completed. Start a new payment from the merchant." />
              </div>
            ) : null}

            {!isTerminal && expired ? (
              <ErrorAlert message="This payment link has expired. Do not pay; start a new payment from the merchant." />
            ) : null}

            {!isTerminal && !expired ? (
              <>
                {remaining ? (
                  <p className="mb-3 text-center text-sm" style={{ color: 'var(--qp-text-secondary)' }}>
                    Pay within <span className="font-semibold tabular-nums">{remaining}</span>
                  </p>
                ) : null}

                {method === 'UPI' ? (
                  <div className="flex flex-col items-center gap-2">
                    <QrImage qr={qr} alt={`UPI QR for ${view.upi ?? ''}`} />
                    <div className="flex max-w-full items-center gap-1.5">
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
                        {view.upi}
                      </span>
                      <CopyButton value={view.upi} label="Copy UPI ID" />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      Pay exactly this amount to {view.payee_name}. Scan with any UPI app.
                    </p>
                    {upiIntent ? (
                      <a href={upiIntent} className="text-sm font-semibold underline sm:hidden" style={{ color: 'var(--qp-primary)' }}>
                        Open UPI app
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {method === 'MANUAL_BANK' ? (
                  <div>
                    <p className="mb-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      Transfer exactly this amount by IMPS, NEFT or RTGS to the account below.
                    </p>
                    <div className="rounded-qp-card border px-3" style={{ borderColor: 'var(--qp-border)' }}>
                      <DetailRow label="Account holder" value={instructions.account_holder_name} copyLabel="Copy account holder" />
                      <DetailRow label="Account number" value={instructions.account_number} copyLabel="Copy account number" />
                      <DetailRow label="IFSC" value={instructions.ifsc} copyLabel="Copy IFSC" />
                      <DetailRow label="Bank" value={instructions.bank_name} copyLabel="Copy bank name" />
                    </div>
                  </div>
                ) : null}

                {method === 'USDT_TRC20' ? (
                  <div className="flex flex-col items-center gap-2">
                    <QrImage qr={qr} alt="USDT TRC20 deposit address QR" />
                    <div className="w-full rounded-qp-card border px-3" style={{ borderColor: 'var(--qp-border)' }}>
                      <DetailRow label="USDT address (TRC20)" value={instructions.address} copyLabel="Copy USDT address" />
                      <DetailRow label="Deposit reference" value={instructions.deposit_ref} copyLabel="Copy deposit reference" />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      Send USDT on the TRON (TRC20) network only. Transfers on any other network are lost.
                    </p>
                  </div>
                ) : null}

                {method === 'MANUAL_BANK' ? (
                  <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void handleAttachment(event)}>
                    {view.proof_submitted ? (
                      <ErrorAlert type="success" message="Screenshot received. We are confirming your transfer; this page updates by itself." />
                    ) : null}
                    <p className="text-sm" style={{ color: 'var(--qp-text-secondary)' }}>
                      After you transfer, upload the payment screenshot. Your payment is confirmed once the bank credit is checked.
                    </p>
                    {submitError ? <ErrorAlert message={submitError} /> : null}
                    {proofField(view.proof_submitted ? 'Replace screenshot' : 'Payment screenshot')}
                    <PrimaryButton type="submit" loading={submitting} disabled={submitting || !proof}>
                      Upload screenshot
                    </PrimaryButton>
                  </form>
                ) : (
                  <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void handleReference(event)}>
                    {view.utr_submitted ? (
                      <ErrorAlert
                        type="success"
                        message={
                          method === 'USDT_TRC20'
                            ? 'TxID received. We are confirming your transfer; this page updates by itself.'
                            : 'UTR received. We are confirming your payment; this page updates by itself.'
                        }
                      />
                    ) : method === 'USDT_TRC20' ? (
                      <>
                        <FormField label="Transaction hash (TxID)" required htmlFor="pay-txid" error={submitError}>
                          <Input
                            id="pay-txid"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={64}
                            placeholder="64 character TxID from your wallet"
                            value={reference}
                            onChange={(event) => setReference(event.target.value.replace(/[^a-fA-F0-9]/g, ''))}
                            aria-label="USDT transaction hash"
                          />
                        </FormField>
                        {proofField('Payment screenshot (optional)')}
                        <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                          Submit TxID
                        </PrimaryButton>
                      </>
                    ) : (
                      <>
                        <FormField label="UTR / reference number" required htmlFor="pay-utr" error={submitError}>
                          <Input
                            id="pay-utr"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={12}
                            placeholder="12 digit UTR"
                            value={reference}
                            onChange={(event) => setReference(event.target.value.replace(/\D/g, ''))}
                            aria-label="UTR reference number"
                          />
                        </FormField>
                        {proofField('Payment screenshot (optional)')}
                        <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                          Submit UTR
                        </PrimaryButton>
                      </>
                    )}
                  </form>
                )}
              </>
            ) : null}

            {isTerminal && view.return_url ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                  Returning to the merchant in a few seconds…
                </p>
                <PrimaryButton href={view.return_url}>Return to merchant</PrimaryButton>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}
