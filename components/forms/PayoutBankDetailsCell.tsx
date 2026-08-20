'use client'

import type { PayoutListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { CopyButton } from '@/components/ui/CopyButton'
import { copyText } from '@/lib/copy'

/** Full payee account for display/copy. */
export function payoutAccountNumber(row: PayoutListItem): string {
  const full = row.beneficiary_account?.trim()
  if (full) return full
  return row.beneficiary_account_masked?.trim() || ''
}

export function buildPayoutBankDetailsBlock(row: PayoutListItem): string {
  const lines = [
    ['Beneficiary', row.beneficiary_name],
    ['Account', payoutAccountNumber(row)],
    ['IFSC', row.beneficiary_ifsc],
    ['Bank', row.beneficiary_bank_name],
  ]
    .map(([key, value]) => {
      const trimmed = (value ?? '').trim()
      if (!trimmed || trimmed === '—') return null
      return `${key}: ${trimmed}`
    })
    .filter((line): line is string => Boolean(line))
  return lines.join('\n')
}

function DetailLine({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null
  return (
    <div className="flex min-w-0 gap-1 text-[11px] leading-snug">
      <span className="shrink-0 font-semibold" style={{ color: 'var(--qp-text-muted)' }}>
        {label}
      </span>
      <span className="min-w-0 break-all font-medium" style={{ color: 'var(--qp-text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

/* ─── PayoutBankDetailsCell ──────────────────────────────────────────────────
   List-column bank block: all payee fields visible + one Copy all control.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutBankDetailsCell({ row }: { row: PayoutListItem }) {
  const name = row.beneficiary_name?.trim() || '—'
  const account = payoutAccountNumber(row) || '—'
  const ifsc = row.beneficiary_ifsc?.trim() || '—'
  const bank = row.beneficiary_bank_name?.trim() || '—'
  const block = buildPayoutBankDetailsBlock(row)

  return (
    <div className="flex max-w-[280px] items-start gap-1.5 py-0.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <DetailLine label="Name" value={name} />
        <DetailLine label="A/C" value={account} />
        <DetailLine label="IFSC" value={ifsc} />
        <DetailLine label="Bank" value={bank} />
      </div>
      <CopyButton value={block} label="Copy all bank details" className="mt-0.5" />
    </div>
  )
}

export async function copyPayoutBankDetails(row: PayoutListItem): Promise<boolean> {
  const ok = await copyText(buildPayoutBankDetailsBlock(row))
  if (!ok) {
    toast.error('Nothing to copy')
    return false
  }
  toast.success('Copied')
  return true
}
