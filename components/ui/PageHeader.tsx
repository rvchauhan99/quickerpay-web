'use client'

import Link from 'next/link'
import { Button } from './Button'

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
  meta,
}: {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
  /** Inline secondary info rendered after the title (counts, live indicators). */
  meta?: React.ReactNode
}) {
  return (
    <div className="mb-qp-gap flex min-h-qp-ctl flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--qp-text-primary)]"
            style={{ color: 'var(--qp-text-muted)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {backLabel ?? 'Back'}
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="truncate text-[15px] font-semibold leading-tight" style={{ color: 'var(--qp-text-primary)' }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>{subtitle}</p>
          ) : null}
          {meta ? <div className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>{meta}</div> : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

/* ─── PrimaryButton ───────────────────────────────────────────────────────────
   Standard primary action button — theme accent filled.
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
  if (href) {
    return <Button href={href} variant="primary">{children}</Button>
  }
  return (
    <Button type={type} onClick={onClick} disabled={disabled} loading={loading} variant="primary">
      {children}
    </Button>
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
  if (href) {
    return <Button href={href} variant="secondary">{children}</Button>
  }
  return (
    <Button type={type} onClick={onClick} disabled={disabled} variant="secondary">
      {children}
    </Button>
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
    <Button type={type} onClick={onClick} disabled={disabled} loading={loading} variant="danger">
      {children}
    </Button>
  )
}

/* ─── ErrorAlert / Alert ──────────────────────────────────────────────────────
   Styled alert for API errors and success messages.
──────────────────────────────────────────────────────────────────────────── */
export function ErrorAlert({ message, type = 'error' }: { message: string | null; type?: 'error' | 'success' }) {
  if (!message) return null
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className="flex items-center gap-2 rounded-qp border px-3 py-2 text-xs font-medium"
      style={{
        backgroundColor: type === 'error' ? 'var(--qp-danger-bg)' : 'var(--qp-success-bg)',
        borderColor: type === 'error' ? 'var(--qp-danger-border)' : 'var(--qp-success-border)',
        color: type === 'error' ? 'var(--qp-danger)' : 'var(--qp-success)',
      }}
    >
      <svg className="shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    <div className="flex items-center gap-2 py-4" style={{ color: 'var(--qp-text-muted)' }}>
      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span className="text-xs">Loading...</span>
    </div>
  )
}
