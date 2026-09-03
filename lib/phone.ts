/**
 * E.164 helpers for Admin PhoneInput.
 * Country select uses ISO; national field is digits only (no dial prefix).
 */

export const PHONE_DIAL_OPTIONS = [
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'AE', name: 'UAE', dial: '971' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'BH', name: 'Bahrain', dial: '973' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'GB', name: 'United Kingdom', dial: '44' },
  { iso: 'US', name: 'United States', dial: '1' },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'DE', name: 'Germany', dial: '49' },
  { iso: 'FR', name: 'France', dial: '33' },
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'NP', name: 'Nepal', dial: '977' },
] as const

export type PhoneIso = (typeof PHONE_DIAL_OPTIONS)[number]['iso']

const DIAL_BY_LENGTH = [...new Set(PHONE_DIAL_OPTIONS.map((row) => row.dial))].sort(
  (a, b) => b.length - a.length,
)

const DEFAULT_ISO: PhoneIso = 'IN'

export function dialForIso(iso: string): string {
  return PHONE_DIAL_OPTIONS.find((row) => row.iso === iso)?.dial ?? '91'
}

export function isoForDial(dial: string): PhoneIso {
  const match = PHONE_DIAL_OPTIONS.find((row) => row.dial === dial)
  return match?.iso ?? DEFAULT_ISO
}

/** Strip the selected dial if the user pasted it into the national box. */
export function stripMatchingDialPrefix(dial: string, national: string): string {
  const d = dial.replace(/\D/g, '')
  let n = national.replace(/\D/g, '')
  if (n.startsWith('0')) n = n.replace(/^0+/, '')
  if (d && n.startsWith(d) && n.length > d.length) {
    n = n.slice(d.length)
  }
  return n
}

/**
 * Split a stored E.164 (or legacy India national) into dial + national digits.
 * Longest dial match first so +971 wins over a shorter prefix.
 */
export function splitE164(value: string | null | undefined): { dial: string; national: string; iso: PhoneIso } {
  const raw = (value ?? '').trim()
  if (!raw) return { dial: '91', national: '', iso: DEFAULT_ISO }

  const digits = raw.replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) {
    return { dial: '91', national: digits, iso: 'IN' }
  }
  if (/^91[6-9]\d{9}$/.test(digits)) {
    return { dial: '91', national: digits.slice(2), iso: 'IN' }
  }

  // Dial-only placeholder from parent (e.g. "+971") while national is still empty
  if (raw.startsWith('+') && digits.length >= 1 && digits.length <= 4) {
    const known = DIAL_BY_LENGTH.find((dial) => dial === digits)
    if (known) return { dial: known, national: '', iso: isoForDial(known) }
  }

  for (const dial of DIAL_BY_LENGTH) {
    if (digits.startsWith(dial) && digits.length > dial.length) {
      const national = digits.slice(dial.length)
      if (national.length >= 4) {
        return { dial, national, iso: isoForDial(dial) }
      }
    }
  }

  return { dial: '91', national: digits, iso: DEFAULT_ISO }
}

export function composeE164(dial: string, national: string): string {
  const d = dial.replace(/\D/g, '')
  const n = stripMatchingDialPrefix(d, national)
  if (!d || !n) return ''
  return `+${d}${n}`
}

/**
 * If the user pasted a full international number into the national field,
 * re-parse into dial + national. Otherwise treat as national digits only.
 */
export function interpretNationalInput(
  currentDial: string,
  rawInput: string,
): { dial: string; national: string; iso: PhoneIso } {
  const trimmed = rawInput.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (trimmed.startsWith('+') && digits.length >= 8) {
    return splitE164(trimmed)
  }

  // Pasted international without +: long enough to include a known dial + national
  if (!trimmed.startsWith('+') && digits.length >= 11) {
    for (const dial of DIAL_BY_LENGTH) {
      if (digits.startsWith(dial) && digits.length - dial.length >= 4) {
        return {
          dial,
          national: digits.slice(dial.length),
          iso: isoForDial(dial),
        }
      }
    }
  }

  const dial = currentDial.replace(/\D/g, '') || '91'
  return {
    dial,
    national: stripMatchingDialPrefix(dial, digits),
    iso: isoForDial(dial),
  }
}
