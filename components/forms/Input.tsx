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
        'h-qp-ctl w-full rounded-qp border px-qp-ctl-x text-qp-body transition-colors',
        'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-70',
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
