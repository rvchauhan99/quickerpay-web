/** Matches packages/shared-types TENANT_TIMEZONE — Asia/Kolkata, no DST. */
const TENANT_TIMEZONE = 'Asia/Kolkata'

const istDisplay = new Intl.DateTimeFormat('en-IN', {
  timeZone: TENANT_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: true,
})

/** Human datetime for CRM / hosted UI — always Asia/Kolkata. */
export function formatDateTimeIst(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return istDisplay.format(date)
}
