'use client'

import { toMinor } from '@quickerpay/money'

export function MoneyInput({
  id,
  label,
  valueMinor,
  onChangeMinor,
}: {
  id: string
  label: string
  valueMinor: number
  onChangeMinor: (amountMinor: number) => void
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-zinc-600" htmlFor={id}>
      {label}
      <input
        id={id}
        className="h-7 rounded border border-zinc-300 px-2 text-sm tabular-nums text-zinc-900"
        inputMode="decimal"
        aria-label={label}
        defaultValue={valueMinor ? String(valueMinor / 100) : ''}
        onChange={(event) => {
          try {
            onChangeMinor(Number(toMinor(event.target.value)))
          } catch {
            return
          }
        }}
      />
    </label>
  )
}
