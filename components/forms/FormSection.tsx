/* ─── FormSection ─────────────────────────────────────────────────────────────
   Named section block inside a form card.
   Renders an emerald-tinted section header + content area.
   Usage:
     <FormSection title="Basic Information">
       <FormGrid>...</FormGrid>
     </FormSection>
──────────────────────────────────────────────────────────────────────────── */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="mb-4 flex items-center gap-2.5 border-b pb-2.5"
        style={{
          borderColor: 'var(--qp-border)',
        }}
      >
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--qp-primary)' }}
        />
        <div>
          <p className="text-[11.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--qp-primary-dark)' }}>
            {title}
          </p>
          {description ? <p className="mt-0.5 text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>{description}</p> : null}
        </div>
      </div>
      <div className="px-1 pb-1">
        {children}
      </div>
    </div>
  )
}
