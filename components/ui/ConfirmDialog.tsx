'use client'

/* ─── ConfirmDialog ───────────────────────────────────────────────────────────
   Premium modal confirmation dialog.
   Usage:
     <ConfirmDialog
       title="Reject this Pay-In?"
       subtitle="This action cannot be undone."
       confirmLabel="Reject"
       variant="danger"
       onConfirm={() => void handleReject()}
       onCancel={() => setConfirm(null)}
     />
──────────────────────────────────────────────────────────────────────────── */
export function ConfirmDialog({
  title,
  subtitle,
  confirmLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: {
  title: string
  subtitle?: string
  confirmLabel: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  const confirmBg = variant === 'danger' ? 'var(--qp-danger)' : 'var(--qp-primary)'
  const iconColor = variant === 'danger' ? 'var(--qp-danger)' : 'var(--qp-primary)'
  const iconBg = variant === 'danger' ? 'var(--qp-danger-bg)' : 'var(--qp-primary-light)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} role="dialog" aria-label={title}>
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--qp-card)',
          borderColor: 'var(--qp-border)',
          boxShadow: 'var(--qp-shadow-lg)',
        }}
      >
        {/* Icon */}
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
          {variant === 'danger' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: iconColor }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: iconColor }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
            </svg>
          )}
        </div>

        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h3>
        {subtitle ? (
          <p className="mb-5 text-xs" style={{ color: 'var(--qp-text-muted)' }}>{subtitle}</p>
        ) : <div className="mb-5" />}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: confirmBg }}
          >
            {loading ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
