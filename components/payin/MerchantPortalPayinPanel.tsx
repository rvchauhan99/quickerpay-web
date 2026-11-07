'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import type {
  PaymentMethod,
  PortalPayinCreateResult,
  PortalPayinPayView,
} from '@quickerpay/shared-types'
import { Smartphone } from 'lucide-react'
import { PaymentMethodCard } from '@/app/pay/[token]/PaymentMethodCard'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { CopyButton } from '@/components/ui/CopyButton'
import { ErrorAlert, PrimaryButton } from '@/components/ui/PageHeader'
import { ApiClientError, apiRequest } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { buildPayinUpiIntent } from '@/lib/payoutUpi'

const QR_PX = 148
const UTR_PATTERN = /^\d{12}$/
const BANK_REF_PATTERN = /^\d{9,22}$/
const TXID_PATTERN = /^[a-fA-F0-9]{64}$/

function formatApiError(caught: unknown, fallback: string): string {
  if (!(caught instanceof ApiClientError)) return fallback
  const base = caught.displayMessage()
  return caught.requestId ? `${base} (request ${caught.requestId})` : base
}

function useQr(value: string | null): string | null {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    if (!value) {
      setQr(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, { width: QR_PX, margin: 1, errorCorrectionLevel: 'M' }).then(
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

function DetailRow({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string | null | undefined
  copyLabel: string
}) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="break-all font-mono text-sm font-medium text-slate-900">{value}</p>
      </div>
      <CopyButton value={value} label={copyLabel} />
    </div>
  )
}

export function MerchantPortalPayinPanel({
  accessToken,
  onClose,
  onSubmitted,
}: {
  accessToken: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
}) {
  const [amountMinor, setAmountMinor] = useState(0)
  const [payinId, setPayinId] = useState<string | null>(null)
  const [view, setView] = useState<PortalPayinPayView | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingMethod, setLoadingMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState<string | null>(null)

  const method = view?.payment_method ?? 'PENDING_METHOD'
  const awaitingMethod = method === 'PENDING_METHOD'
  const availableMethods = view?.available_methods ?? []

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
  const instructions = view?.pay_instructions ?? {}

  const createPayin = async () => {
    if (amountMinor <= 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await apiRequest<PortalPayinCreateResult>('/api/v1/payin/portal', {
        method: 'POST',
        token: accessToken,
        body: { amount_minor: amountMinor },
      })
      setPayinId(created.payin.id)
      setView(created.pay_view)
    } catch (caught) {
      setError(formatApiError(caught, 'Could not create Pay-In'))
    } finally {
      setBusy(false)
    }
  }

  const selectMethod = async (paymentMethod: PaymentMethod) => {
    if (!payinId || busy) return
    setLoadingMethod(paymentMethod)
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<PortalPayinCreateResult>(
        `/api/v1/payin/${payinId}/portal/select-method`,
        {
          method: 'POST',
          token: accessToken,
          body: { payment_method: paymentMethod },
        },
      )
      setView(result.pay_view)
    } catch (caught) {
      setError(formatApiError(caught, 'Could not select payment method'))
    } finally {
      setBusy(false)
      setLoadingMethod(null)
    }
  }

  const submitUtr = async (event: FormEvent) => {
    event.preventDefault()
    if (!payinId || busy) return
    const value = reference.trim()
    const ok =
      method === 'USDT_TRC20'
        ? TXID_PATTERN.test(value)
        : method === 'MANUAL_BANK'
          ? BANK_REF_PATTERN.test(value)
          : UTR_PATTERN.test(value)
    if (!ok) {
      setError(
        method === 'USDT_TRC20'
          ? 'Enter the 64 character transaction hash (TxID) from your wallet'
          : method === 'MANUAL_BANK'
            ? 'Enter the 9 to 22 digit reference from your bank transfer'
            : 'Enter the 12 digit UTR from your UPI app',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/payin/${payinId}/submit-utr`, {
        method: 'POST',
        token: accessToken,
        body: { utr: value },
      })
      await onSubmitted()
    } catch (caught) {
      setError(formatApiError(caught, 'Could not submit UTR'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Add Pay-In</h2>
          <p className="text-xs text-slate-500">
            Enter amount, pay via QR or bank details, then submit the UTR
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      {!view ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:max-w-xs sm:flex-1">
            <FormField label="Amount" required>
              <MoneyInput
                id="portal-amount"
                valueMinor={amountMinor}
                onChangeMinor={setAmountMinor}
                wholeRupees
              />
            </FormField>
          </div>
          <PrimaryButton
            onClick={() => void createPayin()}
            loading={busy}
            disabled={busy || amountMinor <= 0}
          >
            Continue
          </PrimaryButton>
        </div>
      ) : null}

      {error ? <div className="mt-3"><ErrorAlert message={error} /></div> : null}

      {view ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</p>
            <p className="text-2xl font-extrabold text-slate-900">
              <MoneyDisplay amountMinor={view.amount_minor} />
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-600">
                {view.transaction_number}
              </span>
              <CopyButton value={view.transaction_number} label="Copy TXN ID" />
            </div>
          </div>

          {awaitingMethod ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900">Select payment option</p>
              {availableMethods.length === 0 ? (
                <ErrorAlert message="No payment methods are available for this amount right now." />
              ) : (
                availableMethods.map((item) => (
                  <PaymentMethodCard
                    key={item.payment_method}
                    method={item.payment_method}
                    label={item.label}
                    isLoading={loadingMethod === item.payment_method}
                    disabled={busy}
                    onClick={() => void selectMethod(item.payment_method)}
                  />
                ))
              )}
            </div>
          ) : null}

          {!awaitingMethod && method === 'UPI' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="rounded-lg border border-slate-200 bg-white p-1.5">
                  {qr ? (
                    <img src={qr} alt={`UPI QR for ${view.upi ?? ''}`} className="h-[148px] w-[148px]" />
                  ) : (
                    <div className="flex h-[148px] w-[148px] items-center justify-center text-xs text-slate-400">
                      Generating QR…
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{view.upi}</span>
                  <CopyButton value={view.upi} label="Copy UPI ID" />
                </div>
              </div>
              {upiIntent ? (
                <a
                  href={upiIntent}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white sm:hidden"
                >
                  <Smartphone className="h-4 w-4" />
                  Open in UPI App
                </a>
              ) : null}
            </div>
          ) : null}

          {!awaitingMethod && method === 'MANUAL_BANK' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 divide-y divide-slate-200/80">
              <DetailRow label="Account holder" value={instructions.account_holder_name} copyLabel="Copy account holder" />
              <DetailRow label="Account number" value={instructions.account_number} copyLabel="Copy account number" />
              <DetailRow label="IFSC Code" value={instructions.ifsc} copyLabel="Copy IFSC" />
              <DetailRow label="Bank Name" value={instructions.bank_name} copyLabel="Copy bank name" />
            </div>
          ) : null}

          {!awaitingMethod && method === 'USDT_TRC20' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg border border-slate-200 bg-white p-1.5">
                {qr ? (
                  <img src={qr} alt="USDT TRC20 deposit address QR" className="h-[148px] w-[148px]" />
                ) : (
                  <div className="flex h-[148px] w-[148px] items-center justify-center text-xs text-slate-400">
                    Generating QR…
                  </div>
                )}
              </div>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 divide-y divide-slate-200/80">
                <DetailRow label="USDT address (TRC20)" value={instructions.address} copyLabel="Copy USDT address" />
                <DetailRow label="Deposit reference" value={instructions.deposit_ref} copyLabel="Copy deposit reference" />
              </div>
            </div>
          ) : null}

          {!awaitingMethod ? (
            <form className="flex flex-col gap-2" onSubmit={(event) => void submitUtr(event)}>
              {method === 'USDT_TRC20' ? (
                <FormField label="Transaction hash (TxID)" required htmlFor="portal-txid">
                  <Input
                    id="portal-txid"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={64}
                    placeholder="64 character TxID from your wallet"
                    value={reference}
                    onChange={(event) => setReference(event.target.value.replace(/[^a-fA-F0-9]/g, ''))}
                    aria-label="USDT transaction hash"
                  />
                </FormField>
              ) : (
                <FormField
                  label={method === 'MANUAL_BANK' ? 'UTR / reference' : '12-digit UTR'}
                  required
                  htmlFor="portal-utr"
                >
                  <Input
                    id="portal-utr"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={method === 'MANUAL_BANK' ? 22 : 12}
                    placeholder={method === 'MANUAL_BANK' ? '9 to 22 digits' : 'e.g. 429381029482'}
                    value={reference}
                    onChange={(event) => setReference(event.target.value.replace(/\D/g, ''))}
                    aria-label="UTR reference number"
                  />
                </FormField>
              )}
              <PrimaryButton type="submit" loading={busy} disabled={busy}>
                {method === 'USDT_TRC20' ? 'Submit TxID' : 'Submit UTR'}
              </PrimaryButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
