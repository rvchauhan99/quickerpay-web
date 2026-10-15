'use client'

import { fromMinor, rupeeUnits, toMinor } from '@quickerpay/money'
import { Input } from './Input'

export function MoneyInput({
  id,
  valueMinor,
  onChangeMinor,
  wholeRupees = false,
}: {
  id: string
  valueMinor: number | bigint
  onChangeMinor: (amountMinor: number) => void
  wholeRupees?: boolean
}) {
  const display = Number(valueMinor) === 0 ? '' : wholeRupees
    ? String(rupeeUnits(BigInt(valueMinor)))
    : fromMinor(BigInt(valueMinor)).replace(/^₹/, '')
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-qp-body" style={{ color: 'var(--qp-text-muted)' }}>₹</span>
      <Input
        id={id}
        className="pl-6 tabular-nums"
        inputMode={wholeRupees ? 'numeric' : 'decimal'}
        defaultValue={display}
        onBlur={(event) => {
          try {
            const raw = wholeRupees ? event.target.value.replace(/\.\d+$/, '') : event.target.value
            onChangeMinor(Number(toMinor(raw)))
          } catch {
            // keep previous
          }
        }}
      />
    </div>
  )
}
