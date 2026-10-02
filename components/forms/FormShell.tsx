'use client'

import { ErrorAlert } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'

const MAX_WIDTH = {
  full: undefined,
  narrow: '640px',
  default: '920px',
  wide: '1100px',
} as const

/* ─── FormShell ───────────────────────────────────────────────────────────────
   Compact card-style form shell: optional title bar, body, right-aligned footer.
   Usage:
     <FormShell title="Create User" submitLabel="Create" error={error} onSubmit={...} onCancel={() => router.back()}>
       <FormSection title="Basic Info"><FormGrid>...</FormGrid></FormSection>
     </FormShell>
──────────────────────────────────────────────────────────────────────────── */
export function FormShell({
  title,
  onSubmit,
  onCancel,
  error,
  submitLabel,
  loading = false,
  actions,
  wide = false,
  compact = false,
  width,
  children,
}: {
  title?: string | undefined
  onSubmit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  error?: string | null | undefined
  submitLabel?: string | undefined
  loading?: boolean | undefined
  /** Custom footer actions (e.g. Accept / Reject). Replaces default Cancel/Submit when set. */
  actions?: React.ReactNode | undefined
  /** Shorthand for width="wide". */
  wide?: boolean | undefined
  /** Tighter section spacing. */
  compact?: boolean | undefined
  /** Max width preset. Default: full width of the content area. */
  width?: keyof typeof MAX_WIDTH | undefined
  children: React.ReactNode
}) {
  const showDefaultActions = !actions && (onCancel || onSubmit)
  const showFooter = Boolean(error || actions || showDefaultActions)
  const maxWidth = MAX_WIDTH[width ?? (wide ? 'wide' : 'full')]

  return (
    <div
      className="rounded-qp-card border"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-border)',
        boxShadow: 'var(--qp-shadow-sm)',
        maxWidth,
      }}
    >
      {title ? (
        <div
          className="flex items-center gap-2 border-b px-qp-card py-2"
          style={{ borderColor: 'var(--qp-border)' }}
        >
          <span className="h-3.5 w-1 rounded-full" style={{ backgroundColor: 'var(--qp-primary)' }} aria-hidden="true" />
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h3>
        </div>
      ) : null}

      <form
        className={`${compact ? 'space-y-3' : 'space-y-4'} p-qp-card`}
        onSubmit={(event) => {
          event.preventDefault()
          if (onSubmit) {
            onSubmit()
          }
        }}
      >
        {children}

        {showFooter ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t pt-qp-card"
            style={{ borderColor: 'var(--qp-border)' }}
          >
            <ErrorAlert message={error ?? null} />
            {actions ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">{actions}</div>
            ) : null}
            {showDefaultActions ? (
              <div className="ml-auto flex items-center gap-1.5">
                {onCancel ? (
                  <Button variant="secondary" onClick={onCancel} disabled={loading}>
                    Cancel
                  </Button>
                ) : null}
                {onSubmit ? (
                  <Button type="submit" variant="primary" loading={loading}>
                    {submitLabel || 'Submit'}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  )
}

/* ─── InlineCreatePanel ───────────────────────────────────────────────────────
   Card-style collapsible panel for inline create flows (e.g. Add Bank within Payin).
──────────────────────────────────────────────────────────────────────────── */
export function InlineCreatePanel({
  title,
  onCancel,
  children,
}: {
  title: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="mb-qp-gap rounded-qp-card border border-t-2 p-qp-card"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-border)',
        borderTopColor: 'var(--qp-primary)',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: 'var(--qp-primary-dark)' }}>{title}</p>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-qp text-xs transition-colors hover:bg-[var(--qp-surface)]"
          style={{ color: 'var(--qp-text-muted)' }}
          onClick={onCancel}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {children}
    </div>
  )
}
