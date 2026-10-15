'use client'

import Link from 'next/link'
import type { DashboardStatusSlice } from '@quickerpay/shared-types'
import { formatTenths } from '@/lib/chart'
import { MoneyDisplay } from '@/lib/money'

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'var(--qp-success)',
  REJECTED: 'var(--qp-danger)',
  IN_PROCESS: 'var(--qp-info)',
  INITIATE: 'var(--qp-warning)',
  REFUND: 'var(--qp-accent)',
}

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'var(--qp-border-dark)'
}

/** 100% stacked bar plus a legend table; each row drills into the list filtered by that status. */
export function StatusMix({
  title,
  slices,
  hrefFor,
}: {
  title: string
  slices: ReadonlyArray<DashboardStatusSlice>
  hrefFor?: (status: string) => string | undefined
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--qp-text-secondary)' }}>{title}</p>
        <p className="text-[10.5px] qp-tabular" style={{ color: 'var(--qp-text-muted)' }}>{total} txns</p>
      </div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--qp-surface)' }}
        role="img"
        aria-label={`${title}: ${slices.map((slice) => `${slice.status} ${slice.count}`).join(', ') || 'no rows'}`}
      >
        {slices.map((slice) => (
          <span
            key={slice.status}
            className="block h-full"
            style={{ width: `${total > 0 ? (slice.count / total) * 100 : 0}%`, backgroundColor: statusColor(slice.status) }}
          />
        ))}
      </div>
      <ul className="mt-1.5 space-y-px">
        {slices.length === 0 ? (
          <li className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>No rows in this range</li>
        ) : null}
        {slices.map((slice) => {
          const href = hrefFor?.(slice.status)
          const pctTenths = total > 0 ? Math.round((slice.count * 1000) / total) : 0
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: statusColor(slice.status) }} aria-hidden="true" />
                <span className="truncate">{slice.status}</span>
              </span>
              <span className="text-right qp-tabular" style={{ color: 'var(--qp-text-muted)' }}>{formatTenths(pctTenths)}%</span>
              <span className="text-right qp-tabular">{slice.count}</span>
              <span className="text-right qp-tabular"><MoneyDisplay amountMinor={slice.amount_minor} /></span>
            </>
          )
          const cls = 'grid grid-cols-[minmax(0,1fr)_44px_44px_minmax(0,1.2fr)] items-center gap-2 rounded px-1 py-0.5 text-[11px]'
          return (
            <li key={slice.status}>
              {href ? (
                <Link href={href} className={`${cls} hover:bg-[var(--qp-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qp-primary)]`} style={{ color: 'var(--qp-text-primary)' }}>
                  {row}
                </Link>
              ) : (
                <div className={cls} style={{ color: 'var(--qp-text-primary)' }}>{row}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
