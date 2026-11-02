import { describe, expect, it } from 'vitest'
import { formatDateIst, formatDateTimeIst, formatIsoDay, todayIsoIst } from './datetime'

describe('datetime (Asia/Kolkata)', () => {
  it('formats datetimes as zero-padded DD/MM/YYYY in IST', () => {
    // 2026-11-02T21:40:36Z is 03:10:36 on 3 Nov in IST
    expect(formatDateTimeIst('2026-11-02T21:40:36.000Z')).toBe('03/11/2026, 3:10:36 am')
    expect(formatDateTimeIst('2026-11-02T15:10:36.576+05:30')).toBe('02/11/2026, 3:10:36 pm')
  })

  it('formats dates as DD/MM/YYYY in IST', () => {
    expect(formatDateIst('2026-11-02T21:40:36.000Z')).toBe('03/11/2026')
    expect(formatDateIst('2026-01-05')).toBe('05/01/2026')
  })

  it('renders an empty or invalid value as a dash', () => {
    expect(formatDateTimeIst(null)).toBe('—')
    expect(formatDateTimeIst('')).toBe('—')
    expect(formatDateIst('not-a-date')).toBe('—')
  })

  it('converts a YYYY-MM-DD day without shifting it', () => {
    expect(formatIsoDay('2026-11-03')).toBe('03/11/2026')
  })

  it('takes today from the IST calendar, not the machine zone', () => {
    // 20:00 UTC on 2 Nov is 01:30 on 3 Nov in IST
    expect(todayIsoIst(new Date('2026-11-02T20:00:00Z'))).toBe('2026-11-03')
    // 18:00 UTC on 2 Nov is 23:30 on 2 Nov in IST
    expect(todayIsoIst(new Date('2026-11-02T18:00:00Z'))).toBe('2026-11-02')
  })
})
