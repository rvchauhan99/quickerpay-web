'use client'

import { Fragment, useState } from 'react'
import { Button } from './Button'

/* ─── FilterBar ─────────────────────────────────────────────────────────────── */
export function FilterBar({
  onApply,
  onClear,
  onReload,
  actions,
  collapsible = false,
  children,
}: {
  onApply: () => void
  onClear: () => void
  onReload: () => void
  /** Trailing controls after Reload (e.g. ExportButton). */
  actions?: React.ReactNode
  /** Show a hide/show toggle — use only for long filter sets. */
  collapsible?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className="mb-qp-gap rounded-qp-card border"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-border)',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
    >
      <form
        className="flex flex-wrap items-end gap-2 p-qp-card"
        aria-label="Filters"
        onSubmit={(event) => {
          event.preventDefault()
          onApply()
        }}
      >
        {open ? (
          <div className="grid min-w-[min(100%,260px)] flex-1 grid-cols-2 items-end gap-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {children}
          </div>
        ) : (
          <p className="flex-1 self-center text-xs" style={{ color: 'var(--qp-text-muted)' }}>Filters hidden</p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="submit" size="md" icon={<SearchIcon />}>
            Apply
          </Button>
          <Button variant="secondary" size="md" onClick={onClear}>
            Clear
          </Button>
          <Button variant="secondary" size="md" onClick={onReload} icon={<ReloadIcon />} aria-label="Reload">
            Reload
          </Button>
          {actions}
          {collapsible ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? 'Hide filters' : 'Show filters'}
              icon={<ChevronIcon open={open} />}
            />
          ) : null}
        </div>
      </form>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ReloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
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
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

/* ─── StatCard ──────────────────────────────────────────────────────────────── */
export type StatTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const STAT_TONE_COLOR: Record<StatTone, string> = {
  primary: 'var(--qp-primary)',
  info: 'var(--qp-info)',
  success: 'var(--qp-success)',
  warning: 'var(--qp-warning)',
  danger: 'var(--qp-danger)',
  neutral: 'var(--qp-border-dark)',
}

export function StatCard({
  label,
  href,
  tone = 'primary',
  hint,
  children,
}: {
  label: string
  href?: string | undefined
  tone?: StatTone
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  const inner = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="truncate text-[11px] font-medium" style={{ color: 'var(--qp-text-muted)' }}>
        {label}
      </p>
      <div className="truncate text-lg font-semibold leading-tight qp-tabular" style={{ color: 'var(--qp-text-primary)' }}>
        {children}
      </div>
      {hint ? <div className="truncate text-[10.5px]" style={{ color: 'var(--qp-text-muted)' }}>{hint}</div> : null}
    </div>
  )

  const cls = 'block rounded-qp-card border border-l-[3px] px-qp-card py-2'
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--qp-card)',
    borderColor: 'var(--qp-border)',
    borderLeftColor: STAT_TONE_COLOR[tone],
    boxShadow: 'var(--qp-shadow-sm)',
  }

  if (href) {
    return (
      <a
        href={href}
        className={`${cls} transition-shadow hover:shadow-[var(--qp-shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qp-primary)]`}
        style={cardStyle}
      >
        {inner}
      </a>
    )
  }

  return (
    <div className={cls} style={cardStyle}>
      {inner}
    </div>
  )
}

/* ─── DataTable ─────────────────────────────────────────────────────────────── */
export type DataTableColumn = {
  key: string
  heading: string
  align?: 'left' | 'right' | 'center'
  nowrap?: boolean
  width?: string
}

function cellClass(col: DataTableColumn): string {
  return [
    'qp-tabular',
    col.align === 'right' ? 'qp-cell-right' : col.align === 'center' ? 'qp-cell-center' : '',
    col.nowrap ? 'qp-cell-nowrap' : '',
  ].join(' ')
}

/** Page list with ellipsis: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, lastPage: number): Array<number | 'gap'> {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, index) => index + 1)
  const pages = new Set<number>([1, lastPage, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value))
  if (page >= lastPage - 2) [lastPage - 3, lastPage - 2, lastPage - 1].forEach((value) => pages.add(value))
  const sorted = [...pages].filter((value) => value >= 1 && value <= lastPage).sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1]
    if (index > 0 && previous !== undefined && value - previous > 1) out.push('gap')
    out.push(value)
  })
  return out
}

const PAGER_BTN =
  'flex h-qp-ctl-sm min-w-qp-ctl-sm items-center justify-center rounded-qp border px-1.5 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[var(--qp-surface)]'

export function DataTable({
  columns,
  rows,
  empty,
  pagination,
  onPage,
  onPageSize,
  onRowClick,
  expandedRowKey,
  renderExpandedRow,
  bordered = false,
  striped = false,
  maxHeight,
}: {
  columns: DataTableColumn[]
  rows: Array<Record<string, React.ReactNode> & { _rowClass?: string; _rowKey?: string }>
  empty: React.ReactNode
  pagination?: { page: number; page_size: number; total: number } | undefined
  onPage?: ((page: number) => void) | undefined
  onPageSize?: ((size: number) => void) | undefined
  onRowClick?: ((index: number) => void) | undefined
  expandedRowKey?: string | null | undefined
  renderExpandedRow?: ((index: number) => React.ReactNode) | undefined
  /** Vertical cell separators (dense money lists). */
  bordered?: boolean
  striped?: boolean
  /** Scroll body inside the card with a sticky header, e.g. "calc(100vh - 240px)". */
  maxHeight?: string
}) {
  if (rows.length === 0) return <>{empty}</>

  const start = pagination ? (pagination.page - 1) * pagination.page_size + 1 : 1
  const end = pagination ? Math.min(pagination.page * pagination.page_size, pagination.total) : rows.length
  const lastPage = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.page_size)) : 1
  const tableClass = ['qp-table', bordered ? 'qp-table--bordered' : '', striped ? 'qp-table--striped' : ''].join(' ')

  return (
    <div
      className="overflow-hidden rounded-qp-card border"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
    >
      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className={tableClass}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={col.align === 'right' ? 'qp-cell-right' : col.align === 'center' ? 'qp-cell-center' : undefined}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isExpanded =
                Boolean(renderExpandedRow) &&
                expandedRowKey !== null &&
                expandedRowKey !== undefined &&
                row._rowKey !== null &&
                row._rowKey !== undefined &&
                row._rowKey === expandedRowKey

              return (
                <Fragment key={row._rowKey ?? index}>
                  <tr
                    className={`${row._rowClass ?? ''}${onRowClick ? ' cursor-pointer' : ''}`}
                    onClick={onRowClick ? () => onRowClick(index) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onRowClick(index)
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                    aria-expanded={renderExpandedRow ? isExpanded : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cellClass(col)}>{row[col.key]}</td>
                    ))}
                  </tr>
                  {isExpanded ? (
                    <tr
                      className="qp-expanded-row"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <td
                        colSpan={columns.length}
                        className="!p-2"
                        style={{
                          backgroundColor: 'var(--qp-surface)',
                          borderTop: 'none',
                        }}
                      >
                        {renderExpandedRow?.(index)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && onPage ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-qp-card py-1.5"
          style={{ borderTop: '1px solid var(--qp-border)', backgroundColor: 'var(--qp-surface)' }}
        >
          <div className="flex items-center gap-2">
            <select
              className="h-qp-ctl-sm rounded-qp border px-1.5 text-[11.5px] font-medium"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: 'var(--qp-card)' }}
              aria-label="Page size"
              value={pagination.page_size}
              onChange={(e) => onPageSize?.(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <span className="text-[11.5px] qp-tabular" style={{ color: 'var(--qp-text-muted)' }}>
              {pagination.total === 0 ? '0–0' : `${start}–${end}`} of {pagination.total}
            </span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPage(pagination.page - 1)}
              className={PAGER_BTN}
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: 'var(--qp-card)' }}
            >
              Prev
            </button>
            {pageWindow(pagination.page, lastPage).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-[11.5px]" style={{ color: 'var(--qp-text-muted)' }} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPage(item)}
                  aria-current={item === pagination.page ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  className={PAGER_BTN}
                  style={
                    item === pagination.page
                      ? { borderColor: 'var(--qp-primary)', backgroundColor: 'var(--qp-primary)', color: '#fff' }
                      : { borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: 'var(--qp-card)' }
                  }
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={pagination.page >= lastPage}
              onClick={() => onPage(pagination.page + 1)}
              className={PAGER_BTN}
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: 'var(--qp-card)' }}
            >
              Next
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  )
}

/* ─── TableSkeleton ─────────────────────────────────────────────────────────── */
export function TableSkeleton() {
  return (
    <div
      className="space-y-1.5 rounded-qp-card border p-qp-card"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
      role="status"
      aria-label="Loading"
    >
      <div className="h-7 w-full rounded qp-shimmer" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="h-6 rounded qp-shimmer" style={{ opacity: 1 - i * 0.09 }} />
      ))}
    </div>
  )
}

/* ─── EmptyState ────────────────────────────────────────────────────────────── */
export function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-qp-card border px-4 py-6 text-center"
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', borderStyle: 'dashed' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--qp-text-muted)', marginBottom: '6px' }}>
        <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
      <p className="text-xs font-medium" style={{ color: 'var(--qp-text-secondary)' }}>{message}</p>
      {onClear ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium underline transition-colors"
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
      className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-semibold"
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
    <Button variant="secondary" disabled={isDisabled} onClick={handleClick} icon={<DownloadIcon />}>
      Export Excel
    </Button>
  )
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

/* ─── Toast ─────────────────────────────────────────────────────────────────── */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="mb-qp-gap flex items-center gap-2 rounded-qp border px-3 py-2 text-xs font-medium"
      style={{ backgroundColor: 'var(--qp-success-bg)', borderColor: 'var(--qp-success-border)', color: '#065f46' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      {message}
    </div>
  )
}

