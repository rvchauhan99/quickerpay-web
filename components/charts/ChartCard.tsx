'use client'

export function ChartCard({
  title,
  subtitle,
  actions,
  loading = false,
  error,
  empty,
  emptyMessage = 'No data in this range',
  className = '',
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyMessage?: string
  className?: string
  children: React.ReactNode
}) {
  let body: React.ReactNode = children
  if (loading) {
    body = (
      <div className="flex h-full min-h-[160px] items-end gap-1.5 px-2 pb-2" role="status" aria-label="Loading chart">
        {[40, 65, 30, 80, 55, 70, 45, 60].map((height, index) => (
          <div key={index} className="flex-1 rounded-t qp-shimmer" style={{ height: `${height}%` }} />
        ))}
      </div>
    )
  } else if (error) {
    body = (
      <p className="flex min-h-[120px] items-center justify-center text-xs" role="alert" style={{ color: 'var(--qp-danger)' }}>
        {error}
      </p>
    )
  } else if (empty) {
    body = (
      <p className="flex min-h-[120px] items-center justify-center text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <section
      className={`flex min-w-0 flex-col rounded-qp-card border ${className}`}
      style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
      aria-label={title}
    >
      <header
        className="flex min-h-[34px] flex-wrap items-center justify-between gap-2 border-b px-qp-card py-1.5"
        style={{ borderColor: 'var(--qp-border)' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h2>
          {subtitle ? (
            <p className="truncate text-[10.5px]" style={{ color: 'var(--qp-text-muted)' }}>{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 px-qp-card py-2">{body}</div>
    </section>
  )
}

export function ChartLegend({ items }: { items: ReadonlyArray<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px]" style={{ color: 'var(--qp-text-secondary)' }}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-qp border p-px"
      style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-surface)' }}
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className="h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qp-primary)]"
            style={{
              backgroundColor: active ? 'var(--qp-card)' : 'transparent',
              color: active ? 'var(--qp-text-primary)' : 'var(--qp-text-muted)',
              boxShadow: active ? 'var(--qp-shadow-sm)' : 'none',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
