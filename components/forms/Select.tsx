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
        'h-9 w-full rounded-lg border px-3 text-sm transition-colors appearance-none',
        'bg-no-repeat',
        className,
      ].join(' ')}
      style={{
        borderColor: 'var(--qp-border)',
        backgroundColor: '#ffffff',
        color: 'var(--qp-text-primary)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 10px center',
        backgroundSize: '12px',
        paddingRight: '32px',
        ...((props as { style?: React.CSSProperties }).style),
      }}
    >
      {children}
    </select>
  )
}
