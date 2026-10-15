import { describe, expect, it } from 'vitest'
import { TENANT_TIMEZONE, toIstIsoString, toIstIsoStringOrNull } from './datetime'

describe('toIstIsoString', () => {
  it('formats a UTC instant as Asia/Kolkata with +05:30', () => {
    // 2026-10-15T15:50:23.431Z → 21:20:23.431 IST
    const utc = new Date('2026-10-15T15:50:23.431Z')
    expect(toIstIsoString(utc)).toBe('2026-10-15T21:20:23.431+05:30')
    expect(TENANT_TIMEZONE).toBe('Asia/Kolkata')
  })

  it('returns null for missing dates', () => {
    expect(toIstIsoStringOrNull(null)).toBeNull()
    expect(toIstIsoStringOrNull(undefined)).toBeNull()
  })

  it('never emits a trailing Z', () => {
    expect(toIstIsoString(new Date('2026-01-01T00:00:00.000Z')).endsWith('+05:30')).toBe(true)
  })
})
