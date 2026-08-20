'use client'

import type { PayoutListItem } from '@quickerpay/shared-types'
import { CopyButton } from '@/components/ui/CopyButton'
import { StatusBadge } from '@/components/ui/FilterBar'
import {
  copyPayoutBankDetails,
  payoutAccountNumber,
} from '@/components/forms/PayoutBankDetailsCell'
import { MoneyDisplay } from '@/lib/money'

function SummaryItem({
  label,
  children,
  copyValue,
}: {
  label: string
  children: React.ReactNode
  copyValue?: string | null
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--qp-text-muted)' }}
      >
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--qp-text-primary)' }}>
          {children}
        </div>
        {copyValue !== undefined ? <CopyButton value={copyValue} label={`Copy ${label}`} /> : null}
      </div>
    </div>
  )
}

/* ─── PayoutWithdrawSummary ──────────────────────────────────────────────────
   Read-only row snapshot for Accept / Reject dialogs so the operator can
   confirm they have the correct withdrawal before acting.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutWithdrawSummary({ row }: { row: PayoutListItem }) {
  const beneficiary = row.beneficiary_name?.trim() || '—'
  const account = payoutAccountNumber(row) || '—'
  const ifsc = row.beneficiary_ifsc?.trim() || '—'
  const bank = row.beneficiary_bank_name?.trim() || '—'

  return (
    <div
      className="mb-4 rounded-xl border p-3"
      style={{
        borderColor: 'var(--qp-border)',
        backgroundColor: 'var(--qp-primary-light)',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
      aria-label="Withdrawal details"
    >
      <p
        className="mb-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--qp-primary-dark)' }}
      >
        Withdrawal details
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <SummaryItem label="Created">{new Date(row.created_at).toLocaleString()}</SummaryItem>
        <SummaryItem label="Username">{row.supago_username?.trim() || '—'}</SummaryItem>
        <SummaryItem label="Amount">
          <span className="font-semibold">
            <MoneyDisplay amountMinor={row.amount_minor} />
          </span>
        </SummaryItem>
        <SummaryItem label="Status">
          <StatusBadge status={row.status} />
        </SummaryItem>
        <SummaryItem label="Beneficiary" copyValue={beneficiary}>
          {beneficiary}
        </SummaryItem>
        <SummaryItem label="Account" copyValue={account}>
          {account}
        </SummaryItem>
        <SummaryItem label="IFSC" copyValue={ifsc}>
          {ifsc}
        </SummaryItem>
        <SummaryItem label="Bank" copyValue={bank}>
          {bank}
        </SummaryItem>
        <SummaryItem label="Order id">{row.merchant_order_id?.trim() || '—'}</SummaryItem>
        <SummaryItem label="Gateway ref">{row.reference?.trim() || '—'}</SummaryItem>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void copyPayoutBankDetails(row)}
          className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium"
          style={{
            borderColor: 'var(--qp-border)',
            color: 'var(--qp-text-secondary)',
            backgroundColor: '#fff',
          }}
          aria-label="Copy all bank details"
        >
          Copy all bank details
        </button>
      </div>
    </div>
  )
}
