'use client'

import { percentToBp } from '@quickerpay/money'
import { useState } from 'react'

export function RateInput({
  id,
  label,
  valueBp,
  onChangeBp,
  disabled,
}: {
  id: string
  label: string
  valueBp: number
  onChangeBp: (rateBp: number) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(`${Math.trunc(valueBp / 100)}.${String(valueBp % 100).padStart(2, '0')}`)

  const handleChange = (next: string) => {
    setText(next)
    try {
      onChangeBp(percentToBp(next))
    } catch {
      return
    }
  }

  return (
    <label className="flex flex-col gap-0.5 text-xs text-zinc-600" htmlFor={id}>
      {label}
      <input
        id={id}
        className="h-7 rounded border border-zinc-300 px-2 text-sm tabular-nums text-zinc-900"
        inputMode="decimal"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
      />
    </label>
  )
}
