/* ─── FormField ───────────────────────────────────────────────────────────────
   Wraps any input with a label and optional error message.
   Usage:
     <FormField label="Username" required error="Required">
       <Input value={...} onChange={...} />
     </FormField>
──────────────────────────────────────────────────────────────────────────── */
const WIDTH_CLASS = {
  xs: 'w-full sm:w-[110px]',
  sm: 'w-full sm:w-[140px]',
  md: 'w-full sm:w-[180px]',
  lg: 'w-full sm:w-[240px]',
} as const

export function FormField({
  label,
  required,
  error,
  hint,
  width,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null | undefined
  hint?: string
  /** Fixed width inside flex rows (FilterBar). Grid layouts ignore it on mobile. */
  width?: keyof typeof WIDTH_CLASS
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-qp-label ${width ? WIDTH_CLASS[width] : ''}`}>
      <label
        htmlFor={htmlFor}
        className="truncate text-qp-label font-medium leading-tight"
        style={{ color: 'var(--qp-text-secondary)' }}
      >
        {label}
        {required ? <span className="ml-0.5" style={{ color: 'var(--qp-danger)' }}>*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[10.5px] font-medium leading-tight" style={{ color: 'var(--qp-danger)' }}>{error}</p>
      ) : hint ? (
        <p className="text-[10.5px] leading-tight" style={{ color: 'var(--qp-text-muted)' }}>{hint}</p>
      ) : null}
    </div>
  )
}
