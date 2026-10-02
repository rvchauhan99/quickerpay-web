'use client'

import { percentToBp } from '@quickerpay/money'
import { useState } from 'react'
import { Input } from './Input'

export function RateInput({
  id,
  valueBp,
  onChangeBp,
  disabled,
}: {
  id: string
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
    <div className="relative">
      <Input
        id={id}
        className="pr-7 tabular-nums"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-qp-body" style={{ color: 'var(--qp-text-muted)' }}>%</span>
    </div>
  )
}
