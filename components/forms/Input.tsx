import type { InputHTMLAttributes } from 'react'

/* ─── Styled Input primitive ─────────────────────────────────────────────────
   Use inside <FormField> for automatic label + error display.
   Direct usage: <Input value={...} onChange={...} />
──────────────────────────────────────────────────────────────────────────── */
export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'h-9 w-full rounded-lg border px-3 text-sm transition-colors',
        'placeholder:text-slate-400',
        className,
      ].join(' ')}
      style={{
        borderColor: 'var(--qp-border)',
        backgroundColor: '#ffffff',
        color: 'var(--qp-text-primary)',
        // merged with any inline style passed via props
        ...((props as { style?: React.CSSProperties }).style),
      }}
    />
  )
}
