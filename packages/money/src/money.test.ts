import { describe, expect, it } from 'vitest'
import { fromMinor, toMinor } from './minor'
import { applyRateBp, bpToPercent, percentToBp, splitCommission } from './rates'
import { roundHalfUp } from './rounding'
import { MoneyError } from './errors'

describe('toMinor', () => {
  it('parses Indian grouping from the spec example', () => {
    expect(toMinor('1,00,000.00')).toBe(10_000_000n)
  })

  it('parses a rupee mark and an ungrouped integer as whole rupees', () => {
    expect(toMinor('₹100')).toBe(10_000n)
    expect(toMinor('100')).toBe(10_000n)
  })

  it('parses paise', () => {
    expect(toMinor('100.50')).toBe(10_050n)
    expect(toMinor('0.01')).toBe(1n)
  })

  it('parses a negative amount', () => {
    expect(toMinor('-1,00,000.00')).toBe(-10_000_000n)
    expect(toMinor('₹-21.50')).toBe(-2_150n)
  })

  it('rejects a third decimal place rather than rounding user input', () => {
    expect(() => toMinor('100.555')).toThrow(MoneyError)
  })

  it('rejects empty and non-numeric input', () => {
    expect(() => toMinor('')).toThrow(MoneyError)
    expect(() => toMinor('abc')).toThrow(MoneyError)
  })
})

describe('fromMinor', () => {
  it('formats the spec example with Indian grouping', () => {
    expect(fromMinor(10_000_000n)).toBe('₹1,00,000.00')
  })

  it('formats the observed negative ledger balance', () => {
    expect(fromMinor(-2_189_387_68n)).toBe('₹-21,89,387.68')
  })

  it('pads paise to two digits', () => {
    expect(fromMinor(1n)).toBe('₹0.01')
    expect(fromMinor(100n)).toBe('₹1.00')
  })

  it('round-trips with toMinor', () => {
    const samples = [1n, 50n, 100n, 10_050n, 10_000_000n, 12_34_56_789_01n]
    for (const minor of samples) {
      expect(toMinor(fromMinor(minor))).toBe(minor)
      expect(toMinor(fromMinor(-minor))).toBe(-minor)
    }
  })
})

describe('roundHalfUp', () => {
  it('rounds 0.5 away from zero', () => {
    expect(roundHalfUp(15n, 10n)).toBe(2n)
    expect(roundHalfUp(14n, 10n)).toBe(1n)
    expect(roundHalfUp(-15n, 10n)).toBe(-2n)
  })
})

describe('applyRateBp', () => {
  it('takes 4.00% of ₹1,00,000.00 as 400000 paise', () => {
    expect(applyRateBp(10_000_000n, 400)).toBe(400_000n)
  })

  it('takes 3.50% of ₹1,00,000.00 as 350000 paise', () => {
    expect(applyRateBp(10_000_000n, 350)).toBe(350_000n)
  })

  it('takes 1.50% of ₹1,00,000.00 as 150000 paise', () => {
    expect(applyRateBp(10_000_000n, 150)).toBe(150_000n)
  })

  it('treats 3.33% of ₹100 as 333 paise, not 332 or 334', () => {
    expect(applyRateBp(10_000n, 333)).toBe(333n)
  })
})

describe('splitCommission', () => {
  it('holds the identity on the worked Pay-In example', () => {
    const split = splitCommission(10_000_000n, 400, 350)
    expect(split.merchantCommissionMinor).toBe(400_000n)
    expect(split.adminCommissionMinor).toBe(350_000n)
    expect(split.marginMinor).toBe(50_000n)
    expect(split.merchantCommissionMinor).toBe(split.adminCommissionMinor + split.marginMinor)
  })

  it('holds the identity on the worked Pay-Out example', () => {
    const split = splitCommission(10_000_000n, 200, 150)
    expect(split.merchantCommissionMinor).toBe(200_000n)
    expect(split.adminCommissionMinor).toBe(150_000n)
    expect(split.marginMinor).toBe(50_000n)
  })

  it('keeps merchant = admin + margin exact on 333 paise at 4.00% and 3.50%', () => {
    const split = splitCommission(333n, 400, 350)
    expect(split.merchantCommissionMinor).toBe(split.adminCommissionMinor + split.marginMinor)
  })

  it('absorbs a HALF_UP remainder into the margin on 333 rupees', () => {
    const split = splitCommission(33_300n, 400, 350)
    expect(split.merchantCommissionMinor).toBe(applyRateBp(33_300n, 400))
    expect(split.adminCommissionMinor).toBe(applyRateBp(33_300n, 350))
    expect(split.merchantCommissionMinor).toBe(split.adminCommissionMinor + split.marginMinor)
  })
})

describe('percent and basis points', () => {
  it('converts the documented rates', () => {
    expect(percentToBp('4.00')).toBe(400)
    expect(percentToBp('3.50')).toBe(350)
    expect(percentToBp('1.50')).toBe(150)
    expect(percentToBp('3.25%')).toBe(325)
    expect(bpToPercent(400)).toBe('4.00%')
    expect(bpToPercent(350)).toBe('3.50%')
    expect(bpToPercent(50)).toBe('0.50%')
  })

  it('rejects a float-looking extra decimal', () => {
    expect(() => percentToBp('3.333')).toThrow(MoneyError)
  })
})
