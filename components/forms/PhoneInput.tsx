'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import {
  PHONE_DIAL_OPTIONS,
  type PhoneIso,
  composeE164,
  dialForIso,
  interpretNationalInput,
  splitE164,
  stripMatchingDialPrefix,
} from '@/lib/phone'

export {
  PHONE_DIAL_OPTIONS,
  composeE164,
  interpretNationalInput,
  splitE164,
  stripMatchingDialPrefix,
} from '@/lib/phone'
export type { PhoneIso } from '@/lib/phone'

/**
 * Country dial select (by ISO) + national number only. Parent stores a single E.164 string.
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
  const [iso, setIso] = useState<PhoneIso>(parsed.iso)
  const [national, setNational] = useState(parsed.national)
  const locked = Boolean(disabled || readOnly)
  const dial = dialForIso(iso)

  useEffect(() => {
    const next = splitE164(value)
    setIso(next.iso)
    setNational(next.national)
  }, [value])

  const handleIsoChange = (nextIso: string) => {
    const option = PHONE_DIAL_OPTIONS.find((row) => row.iso === nextIso)
    if (!option) return
    setIso(option.iso)
    const cleaned = stripMatchingDialPrefix(option.dial, national)
    setNational(cleaned)
    const composed = composeE164(option.dial, cleaned)
    onChange(composed || `+${option.dial}`)
  }

  const handleNationalChange = (nextNationalRaw: string) => {
    const interpreted = interpretNationalInput(dial, nextNationalRaw)
    setIso(interpreted.iso)
    setNational(interpreted.national)
    const composed = composeE164(interpreted.dial, interpreted.national)
    onChange(composed || (interpreted.national ? '' : `+${interpreted.dial}`))
  }

  return (
    <div className="grid w-full grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
      <Select
        value={iso}
        disabled={locked}
        aria-label="Country code"
        className="w-full"
        onChange={(event) => handleIsoChange(event.target.value)}
      >
        {PHONE_DIAL_OPTIONS.map((row) => (
          <option key={row.iso} value={row.iso}>
            {row.iso} +{row.dial}
          </option>
        ))}
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={national}
        readOnly={locked}
        disabled={locked}
        aria-label={ariaLabel}
        placeholder="National number"
        className="min-w-0 w-full"
        onChange={(event) => handleNationalChange(event.target.value)}
      />
    </div>
  )
}
