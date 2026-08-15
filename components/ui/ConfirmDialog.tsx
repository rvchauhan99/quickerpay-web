'use client'

export function ConfirmDialog({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30" role="dialog" aria-label={title}>
      <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-3">
        <p className="text-sm">{title}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
