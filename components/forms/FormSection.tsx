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
        className="mb-4 rounded-t-lg px-4 py-2"
        style={{
          backgroundColor: 'var(--qp-primary-light)',
          borderLeft: '3px solid var(--qp-primary)',
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--qp-primary-dark)' }}>
          {title}
        </p>
        {description ? <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p> : null}
      </div>
      <div className="px-1">
        {children}
      </div>
    </div>
  )
}
