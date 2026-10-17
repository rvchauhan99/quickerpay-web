import { MoneyError } from './errors'
import { roundHalfUp } from './rounding'

export const BP_PER_UNIT = 10000n
export const BP_PER_PERCENT = 100n

/**
 * Apply a basis-point rate to an amount in minor units, HALF_UP, once.
 * `applyRateBp(10_000_000n, 400)` is 4.00% of ₹1,00,000.00 = 400_000n paise.
 */
export function applyRateBp(amountMinor: bigint, rateBp: number): bigint {
  assertRateBp(rateBp)
  if (amountMinor === 0n) return 0n
  return roundHalfUp(amountMinor * BigInt(rateBp), BP_PER_UNIT)
}

export function bpToPercent(rateBp: number): string {
  assertRateBp(rateBp)
  const whole = Math.trunc(rateBp / 100)
  const frac = Math.abs(rateBp % 100)
    .toString()
    .padStart(2, '0')
  return `${whole}.${frac}%`
}

/**
 * Parse a percent string such as `3.50` or `3.50%` into integer basis points.
 * A float is rejected: rates are never IEEE-754 values.
 */
export function percentToBp(percent: string): number {
  const trimmed = percent.trim().replace(/%$/, '').trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new MoneyError('INVALID_RATE', `Cannot parse percent: ${percent}`)
  }
  const negative = trimmed.startsWith('-')
  const unsigned = negative ? trimmed.slice(1) : trimmed
  const [whole, frac = ''] = unsigned.split('.')
  const padded = (frac + '00').slice(0, 2)
  const bp = Number.parseInt(whole ?? '0', 10) * 100 + Number.parseInt(padded, 10)
  const signed = negative ? -bp : bp
  assertRateBp(signed)
  return signed
}

export function assertRateBp(rateBp: number): void {
  if (!Number.isInteger(rateBp)) {
    throw new MoneyError('INVALID_RATE', 'Rate must be an integer number of basis points')
  }
  if (rateBp < 0 || rateBp > 10000) {
    throw new MoneyError('INVALID_RATE', `Rate ${rateBp} bp is outside 0..10000`)
  }
}

export interface CommissionSplit {
  merchantCommissionMinor: bigint
  /** Net kept by the Banker after the bottom-line broker. */
  bankerCommissionMinor: bigint
  /** Exchange (upper-line) Agent brokerage. */
  agentCommissionMinor: bigint
  /** Banker (bottom-line) broker brokerage, carved from the Banker gross. */
  bankerAgentCommissionMinor: bigint
  marginMinor: bigint
}

/**
 * Compute merchant, banker, agent and margin independently, then force the
 * identity by assigning the remainder to the margin, per docs/02_DATA_MODEL.md 4.20:
 *
 *   merchant = roundHalfUp(eligible * merchantRate / 10000)
 *   banker gross = roundHalfUp(eligible * bankerRate / 10000)
 *   exchange agent = roundHalfUp(eligible * agentRate / 10000)
 *   broker = roundHalfUp(eligible * bankerAgentRate / 10000)
 *   banker net = banker gross - broker
 *   margin = merchant - banker gross - exchange agent
 *
 * `agentRateBp` and `bankerAgentRateBp` default to 0. A 0 broker leaves banker net
 * equal to the gross, which is the historic Banker commission.
 */
export function splitCommission(
  eligibleMinor: bigint,
  merchantRateBp: number,
  bankerRateBp: number,
  agentRateBp = 0,
  bankerAgentRateBp = 0,
): CommissionSplit {
  if (eligibleMinor <= 0n) {
    throw new MoneyError('INVALID_AMOUNT', 'Eligible amount must be positive')
  }
  assertRateBp(merchantRateBp)
  assertRateBp(bankerRateBp)
  assertRateBp(agentRateBp)
  assertRateBp(bankerAgentRateBp)
  if (bankerAgentRateBp > bankerRateBp) {
    throw new MoneyError('COMMISSION_IDENTITY', 'Banker broker rate cannot exceed the Banker rate')
  }

  const merchantCommissionMinor = applyRateBp(eligibleMinor, merchantRateBp)
  const bankerGrossMinor = applyRateBp(eligibleMinor, bankerRateBp)
  const agentCommissionMinor = applyRateBp(eligibleMinor, agentRateBp)
  const bankerAgentCommissionMinor = applyRateBp(eligibleMinor, bankerAgentRateBp)
  const bankerCommissionMinor = bankerGrossMinor - bankerAgentCommissionMinor
  const marginMinor = merchantCommissionMinor - bankerGrossMinor - agentCommissionMinor

  if (
    merchantCommissionMinor !==
    bankerCommissionMinor + bankerAgentCommissionMinor + agentCommissionMinor + marginMinor
  ) {
    throw new MoneyError('COMMISSION_IDENTITY', 'merchant must equal banker net + broker + agent + margin')
  }

  return {
    merchantCommissionMinor,
    bankerCommissionMinor,
    agentCommissionMinor,
    bankerAgentCommissionMinor,
    marginMinor,
  }
}
