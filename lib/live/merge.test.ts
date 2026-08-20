import { describe, expect, it } from 'vitest'
import type { LiveEventEnvelope } from '@quickerpay/shared-types'
import { applyLiveEnvelope } from './merge'

function envelope(overrides: Partial<LiveEventEnvelope> = {}): LiveEventEnvelope {
  return {
    seq: '1-0',
    entity: 'payin',
    action: 'updated',
    id: 'payin-1',
    status: 'COMPLETED',
    updated_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('applyLiveEnvelope', () => {
  it('removes a row when status transitions out of the active filter', () => {
    const result = applyLiveEnvelope({
      rows: [{ id: 'payin-1', status: 'IN_PROCESS' }],
      event: envelope({ status: 'COMPLETED' }),
      statusFilter: 'IN_PROCESS',
      pagination: { page: 1, page_size: 10, total: 1 },
    })

    expect(result.rows).toEqual([])
    expect(result.pagination?.total).toBe(0)
    expect(result.shouldPullChanges).toBe(false)
  })

  it('requests a changes pull on fallback ticks with empty id', () => {
    const result = applyLiveEnvelope({
      rows: [{ id: 'payin-1', status: 'IN_PROCESS' }],
      event: envelope({ id: '', status: '' }),
      statusFilter: 'IN_PROCESS',
      pagination: null,
    })

    expect(result.rows).toHaveLength(1)
    expect(result.shouldPullChanges).toBe(true)
  })

  it('requests a changes pull when status matches the filter', () => {
    const result = applyLiveEnvelope({
      rows: [],
      event: envelope({ status: 'IN_PROCESS' }),
      statusFilter: 'IN_PROCESS',
      pagination: null,
    })

    expect(result.shouldPullChanges).toBe(true)
  })

  it('removes a row from the unassigned queue when admin_user_id is set', () => {
    const result = applyLiveEnvelope({
      rows: [{ id: 'payout-1', status: 'INITIATE' }],
      event: envelope({
        entity: 'payout',
        id: 'payout-1',
        status: 'INITIATE',
        admin_user_id: 'admin-1',
      }),
      statusFilter: 'INITIATE',
      pagination: { page: 1, page_size: 10, total: 1 },
      unassignedFilter: true,
    })

    expect(result.rows).toEqual([])
    expect(result.pagination?.total).toBe(0)
    expect(result.shouldPullChanges).toBe(false)
  })

  it('still pulls changes for unassigned creates with null admin', () => {
    const result = applyLiveEnvelope({
      rows: [],
      event: envelope({
        entity: 'payout',
        id: 'payout-2',
        status: 'INITIATE',
        admin_user_id: null,
      }),
      statusFilter: 'INITIATE',
      pagination: null,
      unassignedFilter: true,
    })
    expect(result.shouldPullChanges).toBe(true)
  })
})
