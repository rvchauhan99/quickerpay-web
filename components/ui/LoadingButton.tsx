import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'danger' | 'ghost' | 'secondary'
  children: ReactNode
}

function Spinner() {
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

const variantStyles: Record<NonNullable<LoadingButtonProps['variant']>, string> = {
  primary:
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-all disabled:opacity-60',
  danger:
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-all disabled:opacity-60',
  secondary:
    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all disabled:opacity-60',
  ghost:
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all disabled:opacity-60',
}

const variantInlineStyles: Record<NonNullable<LoadingButtonProps['variant']>, React.CSSProperties> = {
  primary: { backgroundColor: 'var(--qp-primary)', color: '#fff' },
  danger: { backgroundColor: 'var(--qp-danger)', color: '#fff' },
  secondary: { borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' },
  ghost: { color: 'var(--qp-text-secondary)' },
}

export const LoadingButton = ({
  loading = false,
  loadingText,
  variant = 'primary',
  children,
  disabled,
  className,
  style,
  ...props
}: LoadingButtonProps) => (
  <button
    type="button"
    {...props}
    disabled={disabled || loading}
    className={`${variantStyles[variant]} ${className ?? ''}`}
    style={{ ...variantInlineStyles[variant], ...style }}
  >
    {loading ? <Spinner /> : null}
    {loading && loadingText ? loadingText : children}
  </button>
)
