'use client'

import { fromMinor, rupeeUnits, toMinor } from '@quickerpay/money'
import { Input } from './Input'

export function MoneyInput({
  id,
  valueMinor,
  onChangeMinor,
  wholeRupees = true,
  live = false,
  placeholder,
}: {
  id: string
  valueMinor: number | bigint
  onChangeMinor: (amountMinor: number) => void
  /** Default true: whole rupees only (no decimals). */
  wholeRupees?: boolean
  /** Report every keystroke, not only on blur, for screens that preview a result as you type. */
  live?: boolean
  placeholder?: string
}) {
  const report = (value: string) => {
    try {
      const raw = wholeRupees ? value.replace(/\.\d+$/, '') : value
      onChangeMinor(live && raw.trim() === '' ? 0 : Number(toMinor(raw)))
    } catch {
      // keep previous
    }
  }
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
        placeholder={placeholder}
        onChange={live ? (event) => report(event.target.value) : undefined}
        onBlur={(event) => report(event.target.value)}
      />
    </div>
  )
}
