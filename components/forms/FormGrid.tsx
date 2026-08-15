/* ─── FormGrid ────────────────────────────────────────────────────────────────
   Responsive field grid: 1 col mobile → 2 col tablet → 3 col desktop.
   Override cols with the `cols` prop.
   Usage:
     <FormGrid>
       <FormField label="Name"><Input .../></FormField>
       <FormField label="Role"><Select .../></FormField>
     </FormGrid>
──────────────────────────────────────────────────────────────────────────── */
export function FormGrid({
  cols = 3,
  children,
  className = '',
}: {
  cols?: 1 | 2 | 3 | 4
  children: React.ReactNode
  className?: string
}) {
  const colClass =
    cols === 1 ? 'grid-cols-1' :
    cols === 2 ? 'grid-cols-1 md:grid-cols-2' :
    cols === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={`grid gap-4 ${colClass} ${className}`}>
      {children}
    </div>
  )
}

/* ─── ColSpan helper ─────────────────────────────────────────────────────────
   Wrap a FormField in <FullWidth> to make it span all columns.
──────────────────────────────────────────────────────────────────────────── */
export function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full">{children}</div>
}
