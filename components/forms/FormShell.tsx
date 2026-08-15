'use client'

import { ErrorAlert } from '@/components/ui/PageHeader'

/* ─── FormShell ───────────────────────────────────────────────────────────────
   Premium card-style form shell. Wraps form sections in a white rounded card
   with a branded header, scrollable body, and sticky footer.
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
  children,
}: {
  title?: string | undefined
  onSubmit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  error?: string | null | undefined
  submitLabel?: string | undefined
  loading?: boolean | undefined
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-border)',
        boxShadow: 'var(--qp-shadow-md)',
        maxWidth: '860px',
      }}
    >
      {/* Card header */}
      {title ? (
        <div
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--qp-border)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--qp-primary-light)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--qp-primary)' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h3>
        </div>
      ) : null}

      {/* Form body */}
      <form
        className="space-y-6 p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (onSubmit) {
            onSubmit()
          }
        }}
      >
        {children}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: '1px solid var(--qp-border)' }}
        >
          <ErrorAlert message={error ?? null} />
          {onCancel || onSubmit ? (
            <div className="ml-auto flex items-center gap-2">
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="inline-flex h-9 items-center rounded-lg border px-5 text-sm font-medium transition-colors"
                  style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                >
                  Cancel
                </button>
              ) : null}
              {onSubmit ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: 'var(--qp-primary)' }}
                >
                  {loading ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : null}
                  {submitLabel || 'Submit'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
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
      className="mb-4 rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--qp-card)',
        borderColor: 'var(--qp-primary)',
        boxShadow: 'var(--qp-shadow-sm)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-primary-dark)' }}>{title}</p>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors"
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
