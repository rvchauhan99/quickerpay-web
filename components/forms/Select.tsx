import type { SelectHTMLAttributes } from 'react'

/* ─── Styled Select primitive ────────────────────────────────────────────────
   Use inside <FormField> for automatic label + error display.
   Direct usage: <Select value={...} onChange={...}><option .../></Select>
──────────────────────────────────────────────────────────────────────────── */
export function Select({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'h-qp-ctl w-full rounded-qp border px-qp-ctl-x text-qp-body transition-colors appearance-none',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'bg-no-repeat',
        className,
      ].join(' ')}
      style={{
        borderColor: 'var(--qp-border)',
        backgroundColor: '#ffffff',
        color: 'var(--qp-text-primary)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 8px center',
        backgroundSize: '12px',
        paddingRight: '26px',
        ...((props as { style?: React.CSSProperties }).style),
      }}
    >
      {children}
    </select>
  )
}
