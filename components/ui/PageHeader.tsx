'use client'

import Link from 'next/link'

/* ─── PageHeader ──────────────────────────────────────────────────────────────
   Standard header for all list and detail pages.
   Usage:
     <PageHeader
       title="User Management"
       subtitle="12 users"
       action={<a href="/users/new">+ New User</a>}
     />
──────────────────────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  action,
}: {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="mb-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--qp-border)', paddingBottom: '12px' }}
    >
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: 'var(--qp-text-muted)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {backLabel ?? 'Back'}
          </Link>
        ) : null}
        <div>
          <h2 className="text-base font-semibold leading-tight" style={{ color: 'var(--qp-text-primary)' }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--qp-text-muted)' }}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

/* ─── PrimaryButton ───────────────────────────────────────────────────────────
   Standard primary action button — emerald filled.
──────────────────────────────────────────────────────────────────────────── */
export function PrimaryButton({
  href,
  onClick,
  children,
  type = 'button',
  disabled = false,
  loading = false,
}: {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}) {
  const cls =
    'inline-flex items-center gap-1.5 h-9 rounded-lg px-4 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed'
  const style = { backgroundColor: 'var(--qp-primary)' }

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls} style={style}>
      {loading ? (
        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : null}
      {children}
    </button>
  )
}

/* ─── OutlineButton ───────────────────────────────────────────────────────────
   Standard secondary/cancel button — bordered.
──────────────────────────────────────────────────────────────────────────── */
export function OutlineButton({
  href,
  onClick,
  children,
  type = 'button',
  disabled = false,
}: {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const cls =
    'inline-flex items-center gap-1.5 h-9 rounded-lg border px-4 text-sm font-medium transition-all duration-150 disabled:opacity-60'
  const style = {
    borderColor: 'var(--qp-border)',
    color: 'var(--qp-text-secondary)',
    backgroundColor: '#ffffff',
  }

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={style}>
      {children}
    </button>
  )
}

/* ─── DangerButton ────────────────────────────────────────────────────────────
   Standard destructive action button — red filled.
──────────────────────────────────────────────────────────────────────────── */
export function DangerButton({
  onClick,
  children,
  type = 'button',
  disabled = false,
  loading = false,
}: {
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-1.5 h-9 rounded-lg px-4 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60"
      style={{ backgroundColor: 'var(--qp-danger)' }}
    >
      {loading ? (
        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : null}
      {children}
    </button>
  )
}

/* ─── ErrorAlert / Alert ──────────────────────────────────────────────────────
   Styled alert for API errors and success messages.
──────────────────────────────────────────────────────────────────────────── */
export function ErrorAlert({ message, type = 'error' }: { message: string | null; type?: 'error' | 'success' }) {
  if (!message) return null
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium"
      style={{
        backgroundColor: type === 'error' ? 'var(--qp-danger-bg)' : 'var(--qp-success-bg)',
        borderColor: type === 'error' ? 'var(--qp-danger-border)' : 'var(--qp-success-border)',
        color: type === 'error' ? 'var(--qp-danger)' : 'var(--qp-success)',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {type === 'error' ? (
          <>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </>
        ) : (
          <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </>
        )}
      </svg>
      {message}
    </div>
  )
}

/* ─── LoadingSpinner ──────────────────────────────────────────────────────────
   Full-area loading state — replaces the plain "Loading" text.
──────────────────────────────────────────────────────────────────────────── */
export function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2 py-8" style={{ color: 'var(--qp-text-muted)' }}>
      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span className="text-sm">Loading...</span>
    </div>
  )
}
