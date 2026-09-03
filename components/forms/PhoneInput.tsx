'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'

/** Curated dial codes for Admin mobiles (India default). */
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

const DIAL_BY_LENGTH = [...new Set(PHONE_DIAL_OPTIONS.map((row) => row.dial))].sort(
  (a, b) => b.length - a.length,
)

export function splitE164(value: string | null | undefined): { dial: string; national: string } {
  const raw = (value ?? '').trim()
  if (!raw) return { dial: '91', national: '' }

  const digits = raw.replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) {
    return { dial: '91', national: digits }
  }
  if (/^91[6-9]\d{9}$/.test(digits)) {
    return { dial: '91', national: digits.slice(2) }
  }

  for (const dial of DIAL_BY_LENGTH) {
    if (digits.startsWith(dial) && digits.length > dial.length) {
      return { dial, national: digits.slice(dial.length) }
    }
  }

  // Dial-only placeholder from parent (e.g. "+971") while national is still empty
  if (raw.startsWith('+') && digits.length >= 1 && digits.length <= 4) {
    const known = DIAL_BY_LENGTH.find((dial) => dial === digits)
    if (known) return { dial: known, national: '' }
  }

  return { dial: '91', national: digits }
}

export function composeE164(dial: string, national: string): string {
  const d = dial.replace(/\D/g, '')
  const n = national.replace(/\D/g, '')
  if (!d || !n) return ''
  return `+${d}${n}`
}

/**
 * Country dial select + national number. Parent stores a single E.164 string.
 */
export function PhoneInput({
  value,
  onChange,
  disabled,
  readOnly,
  'aria-label': ariaLabel = 'Mobile number',
}: {
  value: string
  onChange: (e164: string) => void
  disabled?: boolean
  readOnly?: boolean
  'aria-label'?: string
}) {
  const parsed = splitE164(value)
  const [dial, setDial] = useState(parsed.dial)
  const [national, setNational] = useState(parsed.national)
  const locked = Boolean(disabled || readOnly)

  useEffect(() => {
    const next = splitE164(value)
    setDial(next.dial)
    setNational(next.national)
  }, [value])

  const handleDialChange = (nextDial: string) => {
    setDial(nextDial)
    const composed = composeE164(nextDial, national)
    // Keep dial selection while national is empty (compose would return '').
    onChange(composed || `+${nextDial}`)
  }

  const handleNationalChange = (nextNationalRaw: string) => {
    const nextNational = nextNationalRaw.replace(/\D/g, '')
    setNational(nextNational)
    const composed = composeE164(dial, nextNational)
    onChange(composed || (nextNational ? '' : `+${dial}`))
  }

  return (
    <div className="grid w-full grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
      <Select
        value={dial}
        disabled={locked}
        aria-label="Country code"
        className="w-full"
        onChange={(event) => handleDialChange(event.target.value)}
      >
        {PHONE_DIAL_OPTIONS.map((row) => (
          <option key={`${row.iso}-${row.dial}`} value={row.dial}>
            {row.iso} +{row.dial}
          </option>
        ))}
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        value={national}
        readOnly={locked}
        disabled={locked}
        aria-label={ariaLabel}
        placeholder="8238475610"
        className="min-w-0 w-full"
        onChange={(event) => handleNationalChange(event.target.value)}
      />
    </div>
  )
}
