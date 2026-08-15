import { fromMinor } from '@quickerpay/money'

export function MoneyDisplay({ amountMinor }: { amountMinor: number | null | undefined }) {
  if (amountMinor === null || amountMinor === undefined) return <span className="text-zinc-400">—</span>
  return <span className="tabular-nums">{fromMinor(BigInt(amountMinor))}</span>
}

export function RateDisplay({ rateBp }: { rateBp: number | null | undefined }) {
  if (rateBp === null || rateBp === undefined) return <span className="text-zinc-400">—</span>
  const negative = rateBp < 0
  const abs = Math.abs(rateBp)
  const whole = Math.trunc(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return (
    <span className="tabular-nums">
      {negative ? '-' : ''}
      {whole}.{frac}%
    </span>
  )
}
