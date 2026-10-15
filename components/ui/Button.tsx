import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-[var(--qp-primary)] text-white font-semibold hover:bg-[var(--qp-primary-dark)]',
  secondary:
    'border border-[var(--qp-border)] bg-[var(--qp-card)] text-[var(--qp-text-secondary)] font-medium hover:bg-[var(--qp-surface)] hover:text-[var(--qp-text-primary)]',
  danger:
    'border border-transparent bg-[var(--qp-danger)] text-white font-semibold hover:brightness-95',
  success:
    'border border-transparent bg-[var(--qp-success)] text-white font-semibold hover:brightness-95',
  ghost:
    'border border-transparent bg-transparent text-[var(--qp-text-secondary)] font-medium hover:bg-[var(--qp-surface)] hover:text-[var(--qp-text-primary)]',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-qp-ctl-sm gap-1 px-2 text-[11.5px]',
  md: 'h-qp-ctl gap-1.5 px-3 text-[12.5px]',
}

export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = ''): string {
  return [
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-qp transition-colors duration-150',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--qp-primary)]',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ].join(' ')
}

export function ButtonSpinner() {
  return (
    <svg
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/* ─── Button ──────────────────────────────────────────────────────────────────
   Shared action button. Density-aware height via --qp-control-h tokens.
──────────────────────────────────────────────────────────────────────────── */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  href,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  href?: string
  icon?: ReactNode
  children?: ReactNode
}) {
  const cls = buttonClassName(variant, size, className)
  const content = (
    <>
      {loading ? <ButtonSpinner /> : icon}
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={props['aria-label']} title={props.title}>
        {content}
      </Link>
    )
  }

  return (
    <button {...props} type={type} disabled={disabled || loading} className={cls}>
      {content}
    </button>
  )
}
