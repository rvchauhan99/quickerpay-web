/**
 * Tenant wall-clock for outbound API/UI timestamps.
 * Storage stays UTC (TIMESTAMPTZ); serialization uses Asia/Kolkata (+05:30, no DST).
 */

export const TENANT_TIMEZONE = 'Asia/Kolkata' as const

const IST_OFFSET = '+05:30'

const istPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TENANT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  fractionalSecondDigits: 3,
})

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/** ISO-8601 instant in IST, e.g. `2026-10-15T21:20:23.431+05:30`. */
export function toIstIsoString(date: Date): string {
  const parts = istPartsFormatter.formatToParts(date)
  const year = part(parts, 'year')
  const month = part(parts, 'month')
  const day = part(parts, 'day')
  const hour = part(parts, 'hour')
  const minute = part(parts, 'minute')
  const second = part(parts, 'second')
  const fraction = part(parts, 'fractionalSecond').padEnd(3, '0').slice(0, 3)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction}${IST_OFFSET}`
}

export function toIstIsoStringOrNull(date: Date | null | undefined): string | null {
  if (date === null || date === undefined) return null
  return toIstIsoString(date)
}
