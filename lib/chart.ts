import type { DashboardGranularity, DashboardStatusSlice } from '@quickerpay/shared-types'

const PAISE_PER_RUPEE = 100n
const UNITS: ReadonlyArray<{ size: bigint; suffix: string }> = [
  { size: 10_000_000n, suffix: 'Cr' },
  { size: 100_000n, suffix: 'L' },
  { size: 1_000n, suffix: 'K' },
]

/** Short axis label for integer paise: `₹8.0L`, `₹1.2Cr`, `₹950`. Never used for exact amounts. */
export function formatCompactMinor(amountMinor: number): string {
  const minor = BigInt(Math.trunc(amountMinor))
  const negative = minor < 0n
  const rupees = (negative ? -minor : minor) / PAISE_PER_RUPEE
  const sign = negative ? '-' : ''
  for (const unit of UNITS) {
    if (rupees >= unit.size) {
      const tenths = (rupees * 10n + unit.size / 2n) / unit.size
      return `₹${sign}${tenths / 10n}.${tenths % 10n}${unit.suffix}`
    }
  }
  return `₹${sign}${rupees}`
}

/** Integer tenths → `12.3`. */
export function formatTenths(tenths: number): string {
  const whole = Math.trunc(tenths)
  const sign = whole < 0 ? '-' : ''
  const abs = Math.abs(whole)
  return `${sign}${Math.trunc(abs / 10)}.${abs % 10}`
}

/** Compact count label: `1.2K`, `950`. */
export function formatCompactCount(count: number): string {
  if (count >= 1000) return `${formatTenths(Math.round(count / 100))}K`
  return String(count)
}

/** Axis ceiling rounded up to 1, 2, 2.5 or 5 × 10^n so four gridlines land on readable values. */
export function niceCeiling(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1
  const exponent = Math.floor(Math.log10(max))
  const base = 10 ** exponent
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * base) return step * base
  }
  return 10 * base
}

export function axisTicks(ceiling: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (ceiling / count) * index)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-10-02` → `02 Oct`; `2026-10-02T14:00` → `14:00`. */
export function bucketLabel(bucket: string, granularity: DashboardGranularity): string {
  if (granularity === 'HOUR') return bucket.slice(11, 16)
  const month = Number(bucket.slice(5, 7))
  return `${bucket.slice(8, 10)} ${MONTHS[month - 1] ?? ''}`.trim()
}

/** Show at most `max` axis labels by skipping evenly. */
export function labelStride(length: number, max: number): number {
  if (length <= max) return 1
  return Math.ceil(length / max)
}

/** Completed share of decided (COMPLETED + REJECTED) rows, one decimal; null when nothing decided. */
export function successRate(slices: ReadonlyArray<DashboardStatusSlice>): string | null {
  const completed = slices.find((slice) => slice.status === 'COMPLETED')?.count ?? 0
  const rejected = slices.find((slice) => slice.status === 'REJECTED')?.count ?? 0
  const decided = completed + rejected
  if (decided === 0) return null
  return `${formatTenths(Math.round((completed * 1000) / decided))}%`
}

/** Integer paise average; truncates leftover paise. Null when there are no rows. */
export function averageMinor(amountMinor: number, count: number): number | null {
  if (count <= 0) return null
  return Number(BigInt(Math.trunc(amountMinor)) / BigInt(count))
}
