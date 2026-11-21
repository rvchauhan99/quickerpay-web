import { describe, expect, it } from 'vitest'
import {
  counterpartiesSideForOps,
  opsCreditFromApi,
  opsDebitFromApi,
  toApiHawalaFilterParams,
  toApiHawalaSides,
} from './hawala-ops'

describe('hawala-ops view map', () => {
  it('maps ops Debit=receiver / Credit=giver to API From/To', () => {
    expect(
      toApiHawalaSides({ kind: 'BANKER', id: 'goli' }, { kind: 'MERCHANT', id: 'baazex' }),
    ).toEqual({
      debit: { kind: 'MERCHANT', id: 'baazex' },
      credit: { kind: 'BANKER', id: 'goli' },
    })
  })

  it('swaps list/filter query params for ops labels', () => {
    expect(
      toApiHawalaFilterParams({
        debitKind: 'BANKER',
        debitId: 'goli',
        creditKind: 'MERCHANT',
        creditId: 'baazex',
      }),
    ).toEqual({
      credit_kind: 'BANKER',
      credit_id: 'goli',
      debit_kind: 'MERCHANT',
      debit_id: 'baazex',
    })
  })

  it('shows API credit under ops Debit and API debit under ops Credit', () => {
    expect(opsDebitFromApi('giver', 'receiver')).toBe('receiver')
    expect(opsCreditFromApi('giver', 'receiver')).toBe('giver')
  })

  it('loads Agent picker only for ops Debit via API CREDIT counterparties', () => {
    expect(counterpartiesSideForOps('DEBIT')).toBe('CREDIT')
    expect(counterpartiesSideForOps('CREDIT')).toBe('DEBIT')
  })
})
