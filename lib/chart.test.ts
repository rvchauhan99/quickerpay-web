import { describe, expect, it } from 'vitest'
import {
  averageMinor,
  axisTicks,
  bucketLabel,
  formatCompactCount,
  formatCompactMinor,
  formatTenths,
  labelStride,
  niceCeiling,
  successRate,
} from './chart'

describe('formatCompactMinor', () => {
  it('formats lakh, crore and thousand scales from paise', () => {
    expect(formatCompactMinor(80_000_000)).toBe('₹8.0L')
    expect(formatCompactMinor(1_390_121_00)).toBe('₹13.9L')
    expect(formatCompactMinor(12_000_000_000)).toBe('₹12.0Cr')
    expect(formatCompactMinor(4_530_000)).toBe('₹45.3K')
    expect(formatCompactMinor(95_000)).toBe('₹950')
    expect(formatCompactMinor(0)).toBe('₹0')
    expect(formatCompactMinor(-21_893_876_8)).toBe('₹-21.9L')
  })
})

describe('axis helpers', () => {
  it('rounds the ceiling to a readable step', () => {
    expect(niceCeiling(0)).toBe(1)
    expect(niceCeiling(7.4)).toBe(10)
    expect(niceCeiling(74_000_000)).toBe(100_000_000)
    expect(niceCeiling(180)).toBe(200)
    expect(niceCeiling(230)).toBe(250)
    expect(axisTicks(200)).toEqual([0, 50, 100, 150, 200])
  })

  it('labels buckets and thins dense axes', () => {
    expect(bucketLabel('2026-10-02', 'DAY')).toBe('02 Oct')
    expect(bucketLabel('2026-10-02T14:00', 'HOUR')).toBe('14:00')
    expect(labelStride(24, 12)).toBe(2)
    expect(labelStride(7, 12)).toBe(1)
    expect(formatCompactCount(1234)).toBe('1.2K')
    expect(formatTenths(1005)).toBe('100.5')
  })
})

describe('ratios', () => {
  it('computes success rate over decided rows only', () => {
    expect(
      successRate([
        { status: 'COMPLETED', count: 3, amount_minor: 0 },
        { status: 'REJECTED', count: 1, amount_minor: 0 },
        { status: 'IN_PROCESS', count: 50, amount_minor: 0 },
      ]),
    ).toBe('75.0%')
    expect(successRate([{ status: 'IN_PROCESS', count: 5, amount_minor: 0 }])).toBeNull()
  })

  it('averages integer paise without floating point', () => {
    expect(averageMinor(1000, 3)).toBe(333)
    expect(averageMinor(1000, 0)).toBeNull()
  })
})
