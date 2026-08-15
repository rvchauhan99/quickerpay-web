'use client'

import { useState } from 'react'

/* ─── FilterBar ─────────────────────────────────────────────────────────────── */
export function FilterBar({
  onApply,
  onClear,
  onReload,
  children,
}: {
  onApply: () => void
  onClear: () => void
  onReload: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className="mb-3 rounded-xl border"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-border)',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
    >
      {/* Header / Toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--qp-border)' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-slate-50 text-xs font-bold uppercase tracking-tight"
          style={{ color: 'var(--qp-text-secondary)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Advanced Filters
        </button>

        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-150"
          style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-muted)', backgroundColor: '#fff' }}
          onClick={onReload}
          title="Reload Data"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Collapsible Content */}
      {open && (
        <form
          className="p-4"
          onSubmit={(event) => {
            event.preventDefault()
            onApply()
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4 items-end">
            {children}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--qp-border)' }}>
            <button
              type="button"
              className="flex h-8 items-center justify-center rounded-lg border px-4 text-xs font-medium transition-all duration-150"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
              onClick={onClear}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff' }}
            >
              Clear filters
            </button>
            <button
              type="submit"
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white transition-all duration-150"
              style={{ backgroundColor: 'var(--qp-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--qp-primary-dark)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--qp-primary)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Apply
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ─── StatCard ──────────────────────────────────────────────────────────────── */
const STAT_BORDER_COLORS = [
  'var(--qp-primary)',
  '#0891b2',
  '#7c3aed',
  '#d97706',
  '#dc2626',
  '#0d9488',
  '#db2777',
  '#2563eb',
]
let _statCardCounter = 0

export function StatCard({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: React.ReactNode
}) {
  const borderColor = STAT_BORDER_COLORS[_statCardCounter++ % STAT_BORDER_COLORS.length]
  const inner = (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
        {label}
      </p>
      <div className="text-xl font-bold qp-tabular" style={{ color: 'var(--qp-text-primary)' }}>
        {children}
      </div>
    </div>
  )

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--qp-card)',
    borderColor: 'var(--qp-border)',
    borderLeftColor: borderColor,
    borderLeftWidth: '4px',
    boxShadow: 'var(--qp-shadow-sm)',
    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
  }

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-xl border p-4"
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = 'var(--qp-shadow-md)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'var(--qp-shadow-sm)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="rounded-xl border p-4" style={cardStyle}>
      {inner}
    </div>
  )
}

/* ─── DataTable ─────────────────────────────────────────────────────────────── */
export function DataTable({
  columns,
  rows,
  empty,
  pagination,
  onPage,
  onPageSize,
}: {
  columns: Array<{ key: string; heading: string }>
  rows: Array<Record<string, React.ReactNode> & { _rowClass?: string }>
  empty: React.ReactNode
  pagination?: { page: number; page_size: number; total: number } | undefined
  onPage?: ((page: number) => void) | undefined
  onPageSize?: ((size: number) => void) | undefined
}) {
  if (rows.length === 0) return <>{empty}</>

  const start = pagination ? (pagination.page - 1) * pagination.page_size + 1 : 1
  const end = pagination ? Math.min(pagination.page * pagination.page_size, pagination.total) : rows.length
  const lastPage = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.page_size)) : 1

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
    >
      <div className="overflow-x-auto">
        <table className="qp-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={row._rowClass ?? ''}>
                {columns.map((col) => (
                  <td key={col.key} className="qp-tabular">{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && onPage ? (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: '1px solid var(--qp-border)', backgroundColor: '#fafafa' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>Rows:</span>
            <select
              className="h-7 rounded-md border px-2 text-xs font-medium"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
              aria-label="Page size"
              value={pagination.page_size}
              onChange={(e) => onPageSize?.(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
              {pagination.total === 0 ? '0' : `${start}–${end}`} of {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => onPage(pagination.page - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
              >
                ‹
              </button>
              <span
                className="flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-xs font-semibold"
                style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary-dark)' }}
              >
                {pagination.page}
              </span>
              <button
                type="button"
                disabled={pagination.page >= lastPage}
                onClick={() => onPage(pagination.page + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ─── TableSkeleton ─────────────────────────────────────────────────────────── */
export function TableSkeleton() {
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
    >
      <div className="h-9 rounded-lg qp-shimmer w-full" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 rounded-lg qp-shimmer" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

/* ─── EmptyState ────────────────────────────────────────────────────────────── */
export function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border py-12 px-4 text-center"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', borderStyle: 'dashed' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--qp-text-muted)', marginBottom: '12px' }}>
        <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
      <p className="text-sm font-medium" style={{ color: 'var(--qp-text-secondary)' }}>{message}</p>
      {onClear ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium underline transition-colors"
          style={{ color: 'var(--qp-primary)' }}
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}

/* ─── StatusBadge ───────────────────────────────────────────────────────────── */
export function StatusBadge({ status }: { status: string }) {
  let dotColor: string
  let bgColor: string
  let textColor: string

  const s = status.toUpperCase()
  if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'ACTIVE' || s === 'VERIFIED' || s === 'ONLINE') {
    dotColor = 'var(--qp-success)'
    bgColor = 'var(--qp-success-bg)'
    textColor = '#065f46'
  } else if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'DISABLED' || s === 'CLOSED' || s === 'DELETED') {
    dotColor = 'var(--qp-danger)'
    bgColor = 'var(--qp-danger-bg)'
    textColor = '#991b1b'
  } else if (s === 'PENDING_APPROVAL' || s === 'PENDING' || s === 'UNMATCHED' || s === 'OFFLINE' || s === 'INITIATE' || s === 'REFUND') {
    dotColor = 'var(--qp-warning)'
    bgColor = 'var(--qp-warning-bg)'
    textColor = '#92400e'
  } else if (s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'IN_PROCESS' || s === 'ASSIGNED') {
    dotColor = 'var(--qp-info)'
    bgColor = 'var(--qp-info-bg)'
    textColor = '#155e75'
  } else {
    dotColor = 'var(--qp-text-muted)'
    bgColor = '#f1f5f9'
    textColor = 'var(--qp-text-secondary)'
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
      {status.replaceAll('_', ' ')}
    </span>
  )
}

/* ─── ExportButton ──────────────────────────────────────────────────────────── */
export function ExportButton({
  disabled,
  canExport = true,
  onExport,
}: {
  disabled: boolean
  canExport?: boolean
  onExport?: () => void | Promise<void>
}) {
  const handleClick = () => {
    if (!onExport) return
    void onExport()
  }
  const isDisabled = disabled || !canExport || !onExport
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      className="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150"
      style={{
        borderColor: 'var(--qp-border)',
        color: isDisabled ? 'var(--qp-text-muted)' : 'var(--qp-text-secondary)',
        backgroundColor: '#fff',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export Excel
    </button>
  )
}

/* ─── DirectionBadge ────────────────────────────────────────────────────────── */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium"
      style={{ backgroundColor: 'var(--qp-success-bg)', borderColor: 'var(--qp-success-border)', color: '#065f46' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      {message}
    </div>
  )
}

