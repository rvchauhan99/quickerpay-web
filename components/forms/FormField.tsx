/* ─── FormField ───────────────────────────────────────────────────────────────
   Wraps any input with a label and optional error message.
   Usage:
     <FormField label="Username" required error="Required">
       <Input value={...} onChange={...} />
     </FormField>
──────────────────────────────────────────────────────────────────────────── */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null | undefined
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-secondary)' }}>
        {label}
        {required ? <span className="ml-0.5" style={{ color: 'var(--qp-danger)' }}>*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium" style={{ color: 'var(--qp-danger)' }}>{error}</p>
      ) : hint ? (
        <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>{hint}</p>
      ) : null}
    </div>
  )
}
