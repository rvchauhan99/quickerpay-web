/** Matches packages/shared-types TENANT_TIMEZONE — Asia/Kolkata, no DST. */
const TENANT_TIMEZONE = 'Asia/Kolkata'

const istDisplay = new Intl.DateTimeFormat('en-GB', {
  timeZone: TENANT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const istDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: TENANT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const istIsoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: TENANT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Human datetime for CRM / hosted UI — `DD/MM/YYYY, h:mm:ss am`, always Asia/Kolkata. */
export function formatDateTimeIst(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? istDisplay.format(date).toLowerCase() : '—'
}

/** Human date for CRM / hosted UI — `DD/MM/YYYY`, always Asia/Kolkata. */
export function formatDateIst(value: string | Date | null | undefined): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatIsoDay(value)
  const date = toDate(value)
  return date ? istDate.format(date) : '—'
}

/** Calendar day `YYYY-MM-DD` (already an IST day, e.g. a filter value or bucket) → `DD/MM/YYYY`. */
export function formatIsoDay(day: string): string {
  const [year, month, date] = day.split('-')
  return year && month && date ? `${date}/${month}/${year}` : day
}

/** Today's calendar day in Asia/Kolkata as `YYYY-MM-DD`, the wire format for `date_from` / `date_to`. */
export function todayIsoIst(now: Date = new Date()): string {
  return istIsoDay.format(now)
}
