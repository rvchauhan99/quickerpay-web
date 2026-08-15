'use client'

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
  return (
    <form
      className="mb-2 flex flex-wrap items-end gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        onApply()
      }}
    >
      {children}
      <button type="submit" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white">
        Apply
      </button>
      <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={onClear}>
        Clear
      </button>
      <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={onReload}>
        Reload
      </button>
    </form>
  )
}

export function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600">
      <p>{message}</p>
      {onClear ? (
        <button type="button" className="mt-2 text-xs underline" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  )
}

export function StatCard({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: React.ReactNode
}) {
  const inner = (
    <>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="text-sm font-medium tabular-nums">{children}</div>
    </>
  )
  if (href) {
    return (
      <a href={href} className="block rounded border border-zinc-200 bg-white px-2 py-1.5 hover:border-zinc-400">
        {inner}
      </a>
    )
  }
  return <div className="rounded border border-zinc-200 bg-white px-2 py-1.5">{inner}</div>
}

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
    <div>
      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-2 py-1 font-medium">
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={`border-t border-zinc-100 ${row._rowClass ?? ''}`}>
                {columns.map((column) => (
                  <td key={column.key} className="px-2 py-1 align-top">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && onPage ? (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
          <select
            className="h-6 rounded border border-zinc-300"
            aria-label="Page size"
            value={pagination.page_size}
            onChange={(event) => onPageSize?.(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>
            {pagination.total === 0 ? '0-0 of 0' : `${start}-${end} of ${pagination.total}`}
          </span>
          <button type="button" className="underline disabled:no-underline disabled:text-zinc-300" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
            Prev
          </button>
          <button type="button" className="underline disabled:no-underline disabled:text-zinc-300" disabled={pagination.page >= lastPage} onClick={() => onPage(pagination.page + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-1 rounded border border-zinc-200 bg-white p-2">
      <div className="h-4 bg-zinc-100" />
      <div className="h-4 bg-zinc-100" />
      <div className="h-4 bg-zinc-100" />
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'SUCCESS' || status === 'COMPLETED' || status === 'ACTIVE' || status === 'VERIFIED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'DISABLED'
        ? 'bg-red-100 text-red-800'
        : status === 'PENDING_APPROVAL' || status === 'PENDING' || status === 'UNMATCHED'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-zinc-100 text-zinc-700'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{status.replaceAll('_', ' ')}</span>
}

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
  return (
    <button
      type="button"
      disabled={disabled || !canExport || !onExport}
      onClick={handleClick}
      className="h-7 rounded border border-zinc-300 px-2 text-xs disabled:text-zinc-400"
    >
      Export Excel
    </button>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{message}</p>
}
