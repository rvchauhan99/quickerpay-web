/* ─── FormGrid ────────────────────────────────────────────────────────────────
   Responsive field grid. Default: 1 col mobile → 2 tablet → 4 desktop → 5 wide.
   Override cols with the `cols` prop.
   Usage:
     <FormGrid>
       <FormField label="Name"><Input .../></FormField>
       <FormField label="Role"><Select .../></FormField>
     </FormGrid>
──────────────────────────────────────────────────────────────────────────── */
const COL_CLASS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
} as const

export function FormGrid({
  cols = 5,
  children,
  className = '',
}: {
  cols?: keyof typeof COL_CLASS
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid gap-x-qp-field-x gap-y-qp-field-y ${COL_CLASS[cols]} ${className}`}>
      {children}
    </div>
  )
}

/* ─── ColSpan helpers ────────────────────────────────────────────────────────
   <FullWidth> spans all columns; <Span2> spans two columns from md up.
──────────────────────────────────────────────────────────────────────────── */
export function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full">{children}</div>
}

export function Span2({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2">{children}</div>
}
