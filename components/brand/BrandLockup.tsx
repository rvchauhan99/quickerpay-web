import { BrandMark } from './BrandMark'

interface BrandLockupProps {
  /** Compact for sidebar; larger for auth panels. */
  size?: 'sm' | 'md' | 'lg'
  /** Dark panel (sidebar / auth left) uses white wordmark. */
  tone?: 'dark' | 'light'
  /** Optional subtitle under the product name. */
  subtitle?: string
  /** Hide wordmark (icon only). */
  markOnly?: boolean
  className?: string
  /** Extra classes for the wordmark column (e.g. sidebar hover opacity). */
  copyClassName?: string
}

const SIZE_MAP = {
  sm: { mark: 32, name: 'text-sm', subtitle: 'text-[10px]', gap: 'gap-2.5' },
  md: { mark: 36, name: 'text-base', subtitle: 'text-[11px]', gap: 'gap-2.5' },
  lg: { mark: 40, name: 'text-lg', subtitle: 'text-[11px]', gap: 'gap-3' },
} as const

export function BrandLockup({
  size = 'sm',
  tone = 'dark',
  subtitle,
  markOnly = false,
  className,
  copyClassName,
}: BrandLockupProps) {
  const dims = SIZE_MAP[size]
  const nameColor = tone === 'dark' ? '#ffffff' : 'var(--qp-text-primary)'
  const subtitleColor = tone === 'dark' ? 'var(--qp-sidebar-muted)' : 'var(--qp-text-muted)'

  return (
    <div className={`flex items-center ${dims.gap} ${className ?? ''}`}>
      <BrandMark size={dims.mark} className="shrink-0" />
      {markOnly ? null : (
        <div className={`flex min-w-0 flex-col whitespace-nowrap ${copyClassName ?? ''}`}>
          <p className={`${dims.name} font-bold leading-none`} style={{ color: nameColor }}>
            SafePay247
          </p>
          {subtitle ? (
            <p
              className={`mt-0.5 font-medium uppercase tracking-widest ${dims.subtitle}`}
              style={{ color: subtitleColor }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
