'use client'

import { useEffect, useState } from 'react'
import type { PayoutListItem } from '@quickerpay/shared-types'
import QRCode from 'qrcode'
import { CopyButton } from '@/components/ui/CopyButton'
import { buildPayoutUpiIntent } from '@/lib/payoutUpi'

/* ─── PayoutUpiQr ────────────────────────────────────────────────────────────
   Accept-modal QR generated from beneficiary_upi via upi://pay intent.
──────────────────────────────────────────────────────────────────────────── */
export function PayoutUpiQr({
  row,
  className,
}: {
  row: PayoutListItem
  className?: string
}) {
  const upi = row.beneficiary_upi?.trim() || ''
  const intent = buildPayoutUpiIntent(row)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!intent) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(intent, { width: 180, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (!cancelled) setDataUrl(url)
      },
      () => {
        if (!cancelled) setDataUrl(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [intent])

  if (!upi || !intent) return null

  return (
    <div
      className={['flex flex-col items-center gap-2 rounded-xl border p-3', className ?? 'mb-4']
        .filter(Boolean)
        .join(' ')}
      style={{
        borderColor: 'var(--qp-border)',
        backgroundColor: '#fff',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
      aria-label="UPI payment QR"
    >
      <p
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--qp-primary-dark)' }}
      >
        Pay via UPI
      </p>
      {dataUrl ? (
        <img src={dataUrl} alt={`UPI QR for ${upi}`} className="h-[180px] w-[180px]" />
      ) : (
        <div
          className="flex h-[180px] w-[180px] items-center justify-center text-xs"
          style={{ color: 'var(--qp-text-muted)' }}
        >
          Generating QR…
        </div>
      )}
      <div className="flex max-w-full items-center gap-1.5">
        <span className="truncate text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
          {upi}
        </span>
        <CopyButton value={upi} label="Copy UPI" />
      </div>
    </div>
  )
}
