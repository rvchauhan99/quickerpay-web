import type { LiveEventEnvelope, Pagination } from '@quickerpay/shared-types'

interface MergeableRow {
  id: string
  status: string
  created_at?: string
  entry_time?: string
}

function rowSortKey(row: MergeableRow): string {
  return row.created_at ?? row.entry_time ?? row.id
}

function statusMatchesFilter(rowStatus: string, statusFilter: string): boolean {
  if (!statusFilter) return true
  return rowStatus === statusFilter
}

export function applyLiveEnvelope<T extends MergeableRow>(params: {
  rows: T[]
  event: LiveEventEnvelope
  statusFilter: string
  pagination: Pagination | null
  /** When true, an event with admin_user_id set has left the unassigned queue. */
  unassignedFilter?: boolean
}): { rows: T[]; pagination: Pagination | null; shouldPullChanges: boolean } {
  if (!params.event.id) {
    return { rows: params.rows, pagination: params.pagination, shouldPullChanges: true }
  }

  const onPage = params.rows.some((row) => row.id === params.event.id)
  const leftUnassigned =
    params.unassignedFilter === true &&
    params.event.admin_user_id !== null &&
    params.event.admin_user_id !== ''

  if (!statusMatchesFilter(params.event.status, params.statusFilter) || leftUnassigned) {
    if (!onPage) {
      return { rows: params.rows, pagination: params.pagination, shouldPullChanges: false }
    }
    const rows = params.rows.filter((row) => row.id !== params.event.id)
    const pagination = params.pagination
      ? { ...params.pagination, total: Math.max(0, params.pagination.total - 1) }
      : null
    return { rows, pagination, shouldPullChanges: false }
  }

  return { rows: params.rows, pagination: params.pagination, shouldPullChanges: true }
}

export function mergeQueueRows<T extends MergeableRow>(params: {
  current: T[]
  incoming: T[]
  statusFilter: string
  page: number
  pageSize: number
  pagination: Pagination | null
}): { rows: T[]; pagination: Pagination | null; pendingOnPage1: number } {
  const byId = new Map(params.current.map((row) => [row.id, row]))
  let pendingOnPage1 = 0
  let addedOnPage1 = 0

  for (const row of params.incoming) {
    const exists = byId.has(row.id)
    if (!statusMatchesFilter(row.status, params.statusFilter)) {
      if (exists) byId.delete(row.id)
      continue
    }
    if (exists) {
      byId.set(row.id, row)
      continue
    }
    if (params.page === 1) {
      byId.set(row.id, row)
      addedOnPage1 += 1
    } else {
      pendingOnPage1 += 1
    }
  }

  let rows = [...byId.values()]
  rows.sort((a, b) => rowSortKey(b).localeCompare(rowSortKey(a)))

  if (params.page === 1 && rows.length > params.pageSize) {
    rows = rows.slice(0, params.pageSize)
  }

  const pagination = params.pagination
    ? {
        ...params.pagination,
        total: params.page === 1 ? params.pagination.total + addedOnPage1 : params.pagination.total,
      }
    : null

  return { rows, pagination, pendingOnPage1 }
}
