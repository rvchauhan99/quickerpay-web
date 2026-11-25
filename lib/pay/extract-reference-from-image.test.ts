import { describe, expect, it } from 'vitest'
import { pickReferenceFromOcrText } from './extract-reference-from-image'

describe('pickReferenceFromOcrText — UPI', () => {
  it('picks labeled UTR', () => {
    expect(pickReferenceFromOcrText('Payment successful\nUTR: 429381029482\nTo: merchant@okaxis', 'UPI')).toBe(
      '429381029482',
    )
  })

  it('picks UPI Ref label', () => {
    expect(pickReferenceFromOcrText('UPI Ref No 918273645012 Amount 500', 'UPI')).toBe('918273645012')
  })

  it('picks bare 12-digit run when unlabeled', () => {
    expect(pickReferenceFromOcrText('Paid ₹100\n429381029482\nCompleted', 'UPI')).toBe('429381029482')
  })

  it('picks spaced 12-digit UTR via compact', () => {
    expect(pickReferenceFromOcrText('UTR 4293 8102 9482', 'UPI')).toBe('429381029482')
  })

  it('prefers labeled over another bare 12-digit', () => {
    expect(
      pickReferenceFromOcrText('Txn 111122223333\nUTR: 429381029482\nPhone 987654321012', 'UPI'),
    ).toBe('429381029482')
  })

  it('returns null when no 12-digit run', () => {
    expect(pickReferenceFromOcrText('Amount 500 Paid', 'UPI')).toBeNull()
    expect(pickReferenceFromOcrText('Ref 12345678', 'UPI')).toBeNull()
  })
})

describe('pickReferenceFromOcrText — MANUAL_BANK', () => {
  it('picks labeled RRN', () => {
    expect(pickReferenceFromOcrText('IMPS success RRN: 3184123456789012', 'MANUAL_BANK')).toBe(
      '3184123456789012',
    )
  })

  it('picks longest 9–22 digit run', () => {
    expect(pickReferenceFromOcrText('A/c 123456789 IFSC SBIN0001 Ref 9876543210987654', 'MANUAL_BANK')).toBe(
      '9876543210987654',
    )
  })

  it('accepts 9-digit bank reference', () => {
    expect(pickReferenceFromOcrText('Reference Number: 123456789', 'MANUAL_BANK')).toBe('123456789')
  })

  it('returns null when no valid bank ref', () => {
    expect(pickReferenceFromOcrText('Amount 500', 'MANUAL_BANK')).toBeNull()
    expect(pickReferenceFromOcrText('Short 12345678', 'MANUAL_BANK')).toBeNull()
  })
})
