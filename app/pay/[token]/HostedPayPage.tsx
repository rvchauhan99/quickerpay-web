'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { GatewayPayPageView, PayinPaymentMethod, PaymentMethod } from '@quickerpay/shared-types'
import { Clock, ShieldCheck, Lock, Smartphone } from 'lucide-react'
import { PaymentMethodCard } from './PaymentMethodCard'
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
const BANK_REF_PATTERN = /^\d{9,22}$/
const TXID_PATTERN = /^[a-fA-F0-9]{64}$/

const SUBTITLE: Record<PayinPaymentMethod, string> = {
  UPI: 'Secure UPI payment',
  MANUAL_BANK: 'Secure bank transfer',
  USDT_TRC20: 'Secure USDT (TRC20) payment',
  PENDING_METHOD: 'Choose how to pay',
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

async function postJson(url: string, payload: unknown): Promise<{ view: GatewayPayPageView | null; message: string | null }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
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
    void QRCode.toDataURL(value, { width: 140, margin: 1, errorCorrectionLevel: 'M' }).then(
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
    <img src={qr} alt={alt} className="h-[140px] w-[140px]" />
  ) : (
    <div className="flex h-[140px] w-[140px] items-center justify-center text-xs" style={{ color: 'var(--qp-text-muted)' }}>
      Generating QR…
    </div>
  )
}

function DetailRow({ label, value, copyLabel }: { label: string; value: string | null | undefined; copyLabel: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1 last:border-b-0" style={{ borderColor: 'var(--qp-border)' }}>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
          {label}
        </p>
        <p className="break-all font-mono text-xs font-medium" style={{ color: 'var(--qp-text-primary)' }}>
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
  const [loadingMethod, setLoadingMethod] = useState<PaymentMethod | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showProof, setShowProof] = useState(false)

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
  const method: PayinPaymentMethod = view?.payment_method ?? 'PENDING_METHOD'
  const awaitingMethod = method === 'PENDING_METHOD'

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

  const selectMethod = async (paymentMethod: PaymentMethod) => {
    setLoadingMethod(paymentMethod)
    await submit(
      () =>
        postJson(`/api/v1/gateway/pay/${encodeURIComponent(token)}/method`, {
          payment_method: paymentMethod,
        }),
      'Could not select this payment method. Try another or retry shortly.',
    )
    setLoadingMethod(null)
  }

  const handleReference = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = reference.trim()
    const referenceOk =
      method === 'USDT_TRC20'
        ? TXID_PATTERN.test(value)
        : method === 'MANUAL_BANK'
          ? BANK_REF_PATTERN.test(value)
          : UTR_PATTERN.test(value)
    if (!referenceOk) {
      setSubmitError(
        method === 'USDT_TRC20'
          ? 'Enter the 64 character transaction hash (TxID) from your wallet'
          : method === 'MANUAL_BANK'
            ? 'Enter the 9 to 22 digit reference from your bank transfer'
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

  const remaining = view && !isTerminal ? remainingLabel(view.expires_at, now) : null
  const expired = remaining === '00:00'
  const isUrgent = view?.expires_at ? Math.max(0, Math.floor((new Date(view.expires_at).getTime() - now) / 1000)) <= 120 : false
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

  const optionalProof = (label: string) =>
    showProof ? (
      proofField(label)
    ) : (
      <button
        type="button"
        className="self-start text-xs font-medium text-blue-700"
        onClick={() => setShowProof(true)}
      >
        Add screenshot
      </button>
    )

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100/70 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] p-3">
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2.5">
          <BrandLockup size="sm" tone="light" subtitle={SUBTITLE[method]} />
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-600" />
            <span>Secure</span>
          </div>
        </div>

        {state === 'loading' ? (
          <div className="py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-r-transparent align-[-0.125em]" />
            <p className="mt-3 text-sm text-slate-500 font-medium">Loading checkout details…</p>
          </div>
        ) : null}

        {state === 'missing' ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-slate-900">Payment link not found</p>
            <p className="mt-1 text-sm text-slate-500">
              Check the link or restart checkout from the merchant.
            </p>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="p-6">
            <ErrorAlert message="Could not load this payment. Check your internet connection and retry." />
            <div className="mt-4 flex justify-center">
              <PrimaryButton onClick={() => void load()}>Retry</PrimaryButton>
            </div>
          </div>
        ) : null}

        {state === 'ready' && view ? (
          <>
            {/* Amount Banner */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2">
              <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                <MoneyDisplay amountMinor={view.amount_minor} />
              </p>
              <div className="flex min-w-0 flex-col items-end gap-1">
                <span className="max-w-[11rem] truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600">
                  {view.transaction_number}
                </span>
                {!isTerminal && remaining ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isUrgent ? 'animate-pulse border border-amber-200 bg-amber-50 text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    <Clock className={`h-3 w-3 ${isUrgent ? 'text-amber-600' : 'text-slate-500'}`} />
                    <span className="tabular-nums font-bold">{remaining}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {view.status === 'COMPLETED' ? (
                <div className="py-2 text-center">
                  <ErrorAlert type="success" message="Payment received successfully. Thank you!" />
                </div>
              ) : null}

              {view.status === 'REJECTED' ? (
                <div className="py-2 text-center">
                  <ErrorAlert message="This payment was not completed. Start a new payment from the merchant." />
                </div>
              ) : null}

              {!isTerminal && expired ? (
                <ErrorAlert message="This payment link has expired. Do not send payment; restart checkout from the merchant." />
              ) : null}

              {!isTerminal && !expired ? (
                <>
                  {/* Stage 1: Method Picker */}
                  {awaitingMethod ? (
                    <div className="flex flex-col gap-2">
                      <h2 className="text-sm font-bold text-slate-900">Select payment option</h2>
                      {submitError ? <ErrorAlert message={submitError} /> : null}
                      {(view.available_methods ?? []).length === 0 ? (
                        <ErrorAlert message="No payment methods are available for this amount right now. Start a new payment from the merchant." />
                      ) : (
                        <div className="flex flex-col gap-2">
                          {(view.available_methods ?? []).map((item) => (
                            <PaymentMethodCard
                              key={item.payment_method}
                              method={item.payment_method}
                              label={item.label}
                              isLoading={loadingMethod === item.payment_method}
                              disabled={submitting}
                              onClick={() => void selectMethod(item.payment_method)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {!awaitingMethod && method === 'UPI' ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="order-2 mx-auto shrink-0 rounded-lg border border-slate-200 bg-white p-1 sm:order-1 sm:mx-0">
                        <QrImage qr={qr} alt={`UPI QR for ${view.upi ?? ''}`} />
                      </div>
                      <div className="order-1 flex min-w-0 flex-1 flex-col gap-2 sm:order-2">
                        {upiIntent ? (
                          <a
                            href={upiIntent}
                            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white sm:hidden"
                          >
                            <Smartphone className="h-4 w-4" />
                            Open UPI app
                          </a>
                        ) : null}
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-slate-800">{view.upi}</span>
                          <CopyButton value={view.upi} label="Copy UPI ID" />
                        </div>
                        <form className="flex flex-col gap-2" onSubmit={(event) => void handleReference(event)}>
                          {view.utr_submitted ? (
                            <ErrorAlert type="success" message="UTR received. We are confirming your payment; this page updates automatically." />
                          ) : (
                            <>
                              <FormField label="12-digit UTR" required htmlFor="pay-utr" error={submitError}>
                                <Input
                                  id="pay-utr"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  maxLength={12}
                                  placeholder="429381029482"
                                  value={reference}
                                  onChange={(event) => setReference(event.target.value.replace(/\D/g, ''))}
                                  aria-label="UTR reference number"
                                />
                              </FormField>
                              {optionalProof('Payment screenshot (optional)')}
                              <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                                Submit UTR
                              </PrimaryButton>
                            </>
                          )}
                        </form>
                      </div>
                    </div>
                  ) : null}

                  {!awaitingMethod && method === 'MANUAL_BANK' ? (
                    <div className="flex flex-col gap-2">
                      <div className="divide-y divide-slate-200/80 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5">
                        <DetailRow label="Account holder" value={instructions.account_holder_name} copyLabel="Copy account holder" />
                        <DetailRow label="Account number" value={instructions.account_number} copyLabel="Copy account number" />
                        <DetailRow label="IFSC Code" value={instructions.ifsc} copyLabel="Copy IFSC" />
                        <DetailRow label="Bank Name" value={instructions.bank_name} copyLabel="Copy bank name" />
                      </div>
                      <form className="flex flex-col gap-2" onSubmit={(event) => void handleReference(event)}>
                        {view.utr_submitted ? (
                          <ErrorAlert type="success" message="UTR received. We are confirming your payment; this page updates automatically." />
                        ) : (
                          <>
                            <FormField label="UTR / reference" required htmlFor="pay-bank-utr" error={submitError}>
                              <Input
                                id="pay-bank-utr"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={22}
                                placeholder="At least 9 digits"
                                value={reference}
                                onChange={(event) => setReference(event.target.value.replace(/\D/g, ''))}
                                aria-label="UTR reference number"
                              />
                            </FormField>
                            {optionalProof('Payment screenshot (optional)')}
                            <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                              Submit UTR
                            </PrimaryButton>
                          </>
                        )}
                      </form>
                    </div>
                  ) : null}

                  {!awaitingMethod && method === 'USDT_TRC20' ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="mx-auto shrink-0 rounded-lg border border-slate-200 bg-white p-1 sm:mx-0">
                        <QrImage qr={qr} alt="USDT TRC20 deposit address QR" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="divide-y divide-slate-200/80 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5">
                          <DetailRow label="USDT address (TRC20)" value={instructions.address} copyLabel="Copy USDT address" />
                          <DetailRow label="Deposit reference" value={instructions.deposit_ref} copyLabel="Copy deposit reference" />
                        </div>
                        <p className="truncate rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                          Send USDT on TRON (TRC20) only.
                        </p>
                        <form className="flex flex-col gap-2" onSubmit={(event) => void handleReference(event)}>
                          {view.utr_submitted ? (
                            <ErrorAlert type="success" message="TxID received. We are confirming your transfer; this page updates automatically." />
                          ) : (
                            <>
                              <FormField label="Transaction hash (TxID)" required htmlFor="pay-txid" error={submitError}>
                                <Input
                                  id="pay-txid"
                                  autoComplete="off"
                                  spellCheck={false}
                                  maxLength={64}
                                  placeholder="64 character TxID"
                                  value={reference}
                                  onChange={(event) => setReference(event.target.value.replace(/[^a-fA-F0-9]/g, ''))}
                                  aria-label="USDT transaction hash"
                                />
                              </FormField>
                              {optionalProof('Payment screenshot (optional)')}
                              <PrimaryButton type="submit" loading={submitting} disabled={submitting}>
                                Submit TxID
                              </PrimaryButton>
                            </>
                          )}
                        </form>
                      </div>
                    </div>
                  ) : null}

                </>
              ) : null}

              {isTerminal && view.return_url ? (
                <div className="mt-2 flex flex-col items-center gap-2">
                  <p className="text-xs text-slate-500">
                    Returning to the merchant in a few seconds…
                  </p>
                  <PrimaryButton href={view.return_url}>Return to merchant</PrimaryButton>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
