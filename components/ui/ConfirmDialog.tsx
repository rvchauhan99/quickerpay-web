'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

/* ─── ConfirmDialog ───────────────────────────────────────────────────────────
   Premium modal confirmation dialog. Portaled to document.body so sticky
   AppShell header / DataTable thead cannot paint over Cancel / Confirm.
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const iconColor = variant === 'danger' ? 'var(--qp-danger)' : 'var(--qp-primary)'
  const iconBg = variant === 'danger' ? 'var(--qp-danger-bg)' : 'var(--qp-primary-light)'

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-qp-card border p-4"
        style={{
          backgroundColor: 'var(--qp-card)',
          borderColor: 'var(--qp-border)',
          boxShadow: 'var(--qp-shadow-lg)',
        }}
      >
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
          {variant === 'danger' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: iconColor }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: iconColor }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
            </svg>
          )}
        </div>

        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h3>
        {subtitle ? (
          <p className="mb-4 text-xs" style={{ color: 'var(--qp-text-muted)' }}>{subtitle}</p>
        ) : <div className="mb-4" />}

        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}
