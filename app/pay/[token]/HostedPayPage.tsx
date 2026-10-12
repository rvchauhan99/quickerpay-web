'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { GatewayPayPageView, PayinPaymentMethod, PaymentMethod } from '@quickerpay/shared-types'
import { Clock, ShieldCheck, Lock, CheckCircle2, ChevronRight, HelpCircle, ArrowUpRight, Smartphone } from 'lucide-react'
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
  const [loadingMethod, setLoadingMethod] = useState<PaymentMethod | null>(null)
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

  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-6 py-6 sm:py-12 bg-slate-100/70 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="w-full max-w-[460px] rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden transition-all">
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <BrandLockup size="md" tone="light" subtitle={SUBTITLE[method]} />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-semibold tracking-tight shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>100% Secure</span>
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
            <div className="bg-slate-50/70 px-5 sm:px-6 py-5 border-b border-slate-100 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Amount to Pay
              </p>
              <p className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                <MoneyDisplay amountMinor={view.amount_minor} />
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                  {view.transaction_number}
                </span>
                <CopyButton value={view.transaction_number} label="Copy TXN ID" />
              </div>

              {!isTerminal && remaining ? (
                <div className="mt-3 flex items-center justify-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      isUrgent
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                        : 'bg-white text-slate-600 border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-600' : 'text-slate-500'}`} />
                    <span>
                      Pay within <span className="tabular-nums font-bold">{remaining}</span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Main Interactive Content */}
            <div className="p-5 sm:p-6 flex flex-col gap-4">
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
                    <div className="flex flex-col gap-3.5">
                      <div className="text-left">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">
                          Select Payment Option
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Choose your preferred payment mode to complete checkout
                        </p>
                      </div>

                      {submitError ? <ErrorAlert message={submitError} /> : null}

                      {(view.available_methods ?? []).length === 0 ? (
                        <ErrorAlert message="No payment methods are available for this amount right now. Start a new payment from the merchant." />
                      ) : (
                        <div className="flex flex-col gap-2.5">
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

                      <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-center">
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[11px] text-slate-400 font-medium">
                          256-Bit SSL Encrypted • Instant Verification
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Stage 2: UPI Payment */}
                  {!awaitingMethod && method === 'UPI' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                          <QrImage qr={qr} alt={`UPI QR for ${view.upi ?? ''}`} />
                        </div>
                        <div className="flex max-w-full items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                          <span className="truncate text-xs sm:text-sm font-semibold text-slate-800">
                            {view.upi}
                          </span>
                          <CopyButton value={view.upi} label="Copy UPI ID" />
                        </div>
                        <p className="text-xs text-center text-slate-500">
                          Scan QR using Google Pay, PhonePe, Paytm, or any UPI app.
                        </p>
                      </div>

                      {upiIntent ? (
                        <a
                          href={upiIntent}
                          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all sm:hidden"
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>Open in UPI App</span>
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Stage 2: Manual Bank Transfer */}
                  {!awaitingMethod && method === 'MANUAL_BANK' ? (
                    <div>
                      <p className="mb-2.5 text-xs text-slate-500 font-medium">
                        Transfer the exact amount via IMPS, NEFT or RTGS to the bank account below:
                      </p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 divide-y divide-slate-200/80">
                        <DetailRow label="Account holder" value={instructions.account_holder_name} copyLabel="Copy account holder" />
                        <DetailRow label="Account number" value={instructions.account_number} copyLabel="Copy account number" />
                        <DetailRow label="IFSC Code" value={instructions.ifsc} copyLabel="Copy IFSC" />
                        <DetailRow label="Bank Name" value={instructions.bank_name} copyLabel="Copy bank name" />
                      </div>
                    </div>
                  ) : null}

                  {/* Stage 2: USDT TRC20 */}
                  {!awaitingMethod && method === 'USDT_TRC20' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <QrImage qr={qr} alt="USDT TRC20 deposit address QR" />
                      </div>
                      <div className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 divide-y divide-slate-200/80">
                        <DetailRow label="USDT address (TRC20)" value={instructions.address} copyLabel="Copy USDT address" />
                        <DetailRow label="Deposit reference" value={instructions.deposit_ref} copyLabel="Copy deposit reference" />
                      </div>
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                        ⚠️ Send USDT on TRON (TRC20) network only. Transfers on other networks cannot be recovered.
                      </p>
                    </div>
                  ) : null}

                  {/* Attachment Form for Manual Bank */}
                  {!awaitingMethod && method === 'MANUAL_BANK' ? (
                    <form className="mt-2 flex flex-col gap-3" onSubmit={(event) => void handleAttachment(event)}>
                      {view.proof_submitted ? (
                        <ErrorAlert type="success" message="Screenshot received. We are verifying your transfer; this page updates automatically." />
                      ) : null}
                      <p className="text-xs text-slate-600">
                        After transferring, upload the payment screenshot to confirm your deposit.
                      </p>
                      {submitError ? <ErrorAlert message={submitError} /> : null}
                      {proofField(view.proof_submitted ? 'Replace screenshot' : 'Payment screenshot')}
                      <PrimaryButton type="submit" loading={submitting} disabled={submitting || !proof}>
                        Upload screenshot
                      </PrimaryButton>
                    </form>
                  ) : null}

                  {/* UTR / Reference Form for UPI and USDT */}
                  {!awaitingMethod && method !== 'MANUAL_BANK' ? (
                    <form className="mt-2 flex flex-col gap-3" onSubmit={(event) => void handleReference(event)}>
                      {view.utr_submitted ? (
                        <ErrorAlert
                          type="success"
                          message={
                            method === 'USDT_TRC20'
                              ? 'TxID received. We are confirming your transfer; this page updates automatically.'
                              : 'UTR received. We are confirming your payment; this page updates automatically.'
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
                          <FormField
                            label="12-digit UTR / Reference Number"
                            required
                            htmlFor="pay-utr"
                            error={submitError}
                            hint="Found in your UPI app under transaction details"
                          >
                            <Input
                              id="pay-utr"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={12}
                              placeholder="e.g. 429381029482"
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
