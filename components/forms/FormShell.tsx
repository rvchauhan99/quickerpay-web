'use client'

export function FormShell({
  onSubmit,
  error,
  submitLabel,
  children,
}: {
  onSubmit: () => void
  error?: string | null
  submitLabel: string
  children: React.ReactNode
}) {
  return (
    <form
      className="max-w-lg space-y-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {children}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <button type="submit" className="h-7 rounded bg-zinc-900 px-3 text-xs text-white">
        {submitLabel}
      </button>
    </form>
  )
}

export function InlineCreatePanel({
  title,
  onCancel,
  children,
}: {
  title: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-2 rounded border border-zinc-200 bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium">{title}</p>
        <button type="button" className="text-xs underline" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {children}
    </div>
  )
}
