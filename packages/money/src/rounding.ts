/**
 * HALF_UP integer division: remainder of 0.5 or more rounds away from zero.
 * Spec: docs/02_DATA_MODEL.md section 4.20 and docs/05_RULES_AND_ACCEPTANCE.md R1.
 *
 * Applied exactly once, at the moment a rate meets an amount. Never round a
 * value that is already minor units, and never round twice.
 */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('Division by zero')
  }
  if (numerator === 0n) return 0n

  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator
  const quotient = absNum / absDen
  const remainder = absNum % absDen

  if (remainder * 2n >= absDen) {
    return sign * (quotient + 1n)
  }
  return sign * quotient
}
