/* ─── FormSection ─────────────────────────────────────────────────────────────
   Named section block inside a form card: compact accent title bar + content.
   Usage:
     <FormSection title="Basic Information">
       <FormGrid>...</FormGrid>
     </FormSection>
──────────────────────────────────────────────────────────────────────────── */
export function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div
        className="mb-2 flex items-start justify-between gap-2 border-b pb-1.5"
        style={{ borderColor: 'var(--qp-border)' }}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--qp-primary)' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--qp-primary-dark)' }}>
              {title}
            </p>
            {description ? (
              <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--qp-text-muted)' }}>{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  )
}
