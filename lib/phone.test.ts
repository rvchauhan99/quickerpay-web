import { describe, expect, it } from 'vitest'
import {
  composeE164,
  interpretNationalInput,
  splitE164,
  stripMatchingDialPrefix,
} from './phone'

describe('splitE164', () => {
  it('parses India E.164', () => {
    expect(splitE164('+918238475610')).toEqual({
      dial: '91',
      national: '8238475610',
      iso: 'IN',
    })
  })

  it('parses UAE E.164 with longest dial first', () => {
    expect(splitE164('+971501234567')).toEqual({
      dial: '971',
      national: '501234567',
      iso: 'AE',
    })
  })

  it('normalizes legacy 10-digit India', () => {
    expect(splitE164('8238475610')).toMatchObject({ dial: '91', national: '8238475610', iso: 'IN' })
  })
})

describe('composeE164 / stripMatchingDialPrefix', () => {
  it('strips dial when pasted into national under UAE', () => {
    expect(stripMatchingDialPrefix('971', '971501234567')).toBe('501234567')
    expect(composeE164('971', '971501234567')).toBe('+971501234567')
  })

  it('does not invent UAE when dial is India', () => {
    expect(stripMatchingDialPrefix('91', '971501234567')).toBe('971501234567')
    expect(composeE164('91', '971501234567')).toBe('+91971501234567')
  })

  it('composes clean national', () => {
    expect(composeE164('971', '501234567')).toBe('+971501234567')
  })
})

describe('interpretNationalInput', () => {
  it('reparses +971 paste under India dial into AE + national', () => {
    expect(interpretNationalInput('91', '+971501234567')).toEqual({
      dial: '971',
      national: '501234567',
      iso: 'AE',
    })
  })

  it('reparses 971… paste without plus when long enough', () => {
    expect(interpretNationalInput('91', '971501234567')).toEqual({
      dial: '971',
      national: '501234567',
      iso: 'AE',
    })
  })

  it('keeps short national under current dial', () => {
    expect(interpretNationalInput('971', '501234567')).toEqual({
      dial: '971',
      national: '501234567',
      iso: 'AE',
    })
  })
})
