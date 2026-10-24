import { describe, expect, it } from 'vitest'
import { fromMinor, rupeeUnits, toMinor } from './minor'
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
  it('formats whole rupees with Indian grouping and no decimals', () => {
    expect(fromMinor(10_000_000n)).toBe('₹1,00,000')
  })

  it('HALF_UP leftover paise on a negative ledger balance for display', () => {
    // 218938768 paise → 2189387.68 → ₹21,89,388
    expect(fromMinor(-2_189_387_68n)).toBe('₹-21,89,388')
  })

  it('HALF_UP 50 paise to ₹1; truncates 49 paise to ₹0', () => {
    expect(fromMinor(50n)).toBe('₹1')
    expect(fromMinor(49n)).toBe('₹0')
    expect(fromMinor(1n)).toBe('₹0')
  })

  it('formats a whole rupee without a fraction', () => {
    expect(fromMinor(100n)).toBe('₹1')
  })

  it('round-trips whole-rupee amounts with toMinor (display is lossy for leftover paise)', () => {
    const wholeRupeeSamples = [100n, 10_000_000n, 12_34_56_789_00n]
    for (const minor of wholeRupeeSamples) {
      expect(toMinor(fromMinor(minor))).toBe(minor)
      expect(toMinor(fromMinor(-minor))).toBe(-minor)
    }
    // 10_050 display → ₹101 (HALF_UP), not a lossless round-trip
    expect(fromMinor(10_050n)).toBe('₹101')
    expect(toMinor(fromMinor(10_050n))).toBe(10_100n)
  })
})

describe('rupeeUnits', () => {
  it('drops leftover paise', () => {
    expect(rupeeUnits(125_000n)).toBe(1_250n)
    expect(rupeeUnits(125_050n)).toBe(1_250n)
    expect(rupeeUnits(1n)).toBe(0n)
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
    expect(split.bankerCommissionMinor).toBe(350_000n)
    expect(split.bankerAgentCommissionMinor).toBe(0n)
    expect(split.agentCommissionMinor).toBe(0n)
    expect(split.marginMinor).toBe(50_000n)
    expect(split.merchantCommissionMinor).toBe(
      split.bankerCommissionMinor +
        split.bankerAgentCommissionMinor +
        split.agentCommissionMinor +
        split.marginMinor,
    )
  })

  it('carves the broker from the Banker and leaves Super Admin margin on the gross rate', () => {
    const split = splitCommission(10_000_000n, 400, 350, 0, 50)
    expect(split.bankerCommissionMinor).toBe(300_000n)
    expect(split.bankerAgentCommissionMinor).toBe(50_000n)
    expect(split.marginMinor).toBe(50_000n)
  })

  it('rejects a broker rate above the Banker rate', () => {
    expect(() => splitCommission(10_000_000n, 400, 350, 0, 400)).toThrow(/cannot exceed the Banker rate/)
  })

  it('holds the identity on the worked Pay-Out example', () => {
    const split = splitCommission(10_000_000n, 200, 150)
    expect(split.merchantCommissionMinor).toBe(200_000n)
    expect(split.bankerCommissionMinor).toBe(150_000n)
    expect(split.agentCommissionMinor).toBe(0n)
    expect(split.marginMinor).toBe(50_000n)
  })

  it('keeps merchant = banker + agent + margin exact on 333 paise at 4.00% and 3.50%', () => {
    const split = splitCommission(333n, 400, 350)
    expect(split.merchantCommissionMinor).toBe(
      split.bankerCommissionMinor + split.agentCommissionMinor + split.marginMinor,
    )
  })

  it('absorbs a HALF_UP remainder into the margin on 333 rupees', () => {
    const split = splitCommission(33_300n, 400, 350)
    expect(split.merchantCommissionMinor).toBe(applyRateBp(33_300n, 400))
    expect(split.bankerCommissionMinor).toBe(applyRateBp(33_300n, 350))
    expect(split.merchantCommissionMinor).toBe(
      split.bankerCommissionMinor + split.agentCommissionMinor + split.marginMinor,
    )
  })

  it('carves agent brokerage from the margin (6% merchant, 1% agent, 3.5% banker)', () => {
    const split = splitCommission(10_000_000n, 600, 350, 100)
    expect(split.merchantCommissionMinor).toBe(600_000n)
    expect(split.bankerCommissionMinor).toBe(350_000n)
    expect(split.agentCommissionMinor).toBe(100_000n)
    expect(split.marginMinor).toBe(150_000n)
    expect(split.merchantCommissionMinor).toBe(
      split.bankerCommissionMinor + split.agentCommissionMinor + split.marginMinor,
    )
  })

  it('matches the no-agent path when agentRateBp is 0', () => {
    const withZero = splitCommission(10_000_000n, 600, 350, 0)
    const legacy = splitCommission(10_000_000n, 600, 350)
    expect(withZero).toEqual(legacy)
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
