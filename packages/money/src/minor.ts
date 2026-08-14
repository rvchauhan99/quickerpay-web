import { MoneyError } from './errors'
import { roundHalfUp } from './rounding'

export const MINOR_PER_MAJOR = 100n

/**
 * Convert a rupee string to integer paise.
 *
 * Accepts Indian grouping (`1,00,000.00`), plain digits, an optional leading
 * `₹` or `-`, and at most two decimal places. Feature code never does this
 * itself: this is the UI-edge conversion from docs/05_RULES_AND_ACCEPTANCE.md R1.
 */
export function toMinor(input: string): bigint {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new MoneyError('INVALID_AMOUNT', 'Amount is empty')
  }

  const withoutSymbol = trimmed.replace(/₹/g, '').trim()
  const negative = withoutSymbol.startsWith('-')
  const unsigned = (negative ? withoutSymbol.slice(1) : withoutSymbol).trim()

  if (!/^\d{1,3}(,\d{2})*(,\d{3})?(\.\d{1,2})?$/.test(unsigned) && !/^\d+(\.\d{1,2})?$/.test(unsigned)) {
    // Allow either Indian grouping or an ungrouped integer/decimal. Reject a
    // third decimal place rather than silently rounding user input.
    if (/^\d[\d,]*\.\d{3,}$/.test(unsigned)) {
      throw new MoneyError('INVALID_AMOUNT', 'Amount has more than two decimal places')
    }
    throw new MoneyError('INVALID_AMOUNT', `Cannot parse amount: ${input}`)
  }

  const [rawRupees, rawPaise = ''] = unsigned.split('.')
  const rupees = (rawRupees ?? '').replace(/,/g, '')
  if (rupees.length === 0 || !/^\d+$/.test(rupees)) {
    throw new MoneyError('INVALID_AMOUNT', `Cannot parse amount: ${input}`)
  }

  const paise = (rawPaise + '00').slice(0, 2)
  const minor = BigInt(rupees) * MINOR_PER_MAJOR + BigInt(paise)
  return negative ? -minor : minor
}

/**
 * Format integer paise as `₹1,00,000.00`, matching the observed product
 * (negative sign after the rupee mark: `₹-21,89,387.68`).
 */
export function fromMinor(minor: bigint): string {
  const negative = minor < 0n
  const abs = negative ? -minor : minor
  const rupees = abs / MINOR_PER_MAJOR
  const paise = abs % MINOR_PER_MAJOR
  const grouped = groupIndian(rupees.toString())
  const fraction = paise.toString().padStart(2, '0')
  return `₹${negative ? '-' : ''}${grouped}.${fraction}`
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const lastThree = digits.slice(-3)
  const rest = digits.slice(0, -3)
  const pairs: string[] = []
  let remaining = rest
  while (remaining.length > 2) {
    pairs.unshift(remaining.slice(-2))
    remaining = remaining.slice(0, -2)
  }
  if (remaining.length > 0) pairs.unshift(remaining)
  return `${pairs.join(',')},${lastThree}`
}

/** @internal exported for tests that need to pin the grouping helper. */
export const _groupIndian = groupIndian

/** Round a rational rupee amount (already in paise-scale numerator) — unused by toMinor. */
export function paiseFromRational(numerator: bigint, denominator: bigint): bigint {
  return roundHalfUp(numerator, denominator)
}
