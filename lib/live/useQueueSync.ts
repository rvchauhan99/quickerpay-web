'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveChangesResponse, LiveEntity, LiveEventEnvelope, Pagination } from '@quickerpay/shared-types'
import { apiRequest } from '../api'
import { mergeQueueRows, applyLiveEnvelope } from './merge'
import { useLiveStream } from './LiveStreamProvider'

const CHANGES_LIMIT = 50

interface UseQueueSyncOptions<T extends { id: string; status: string }> {
  entity: LiveEntity
  enabled: boolean
  accessToken: string | null
  statusFilter: string
  page: number
  pageSize: number
  query: Record<string, string | number | undefined>
  rows: T[]
  setRows: (rows: T[]) => void
  pagination: Pagination | null
  setPagination: (pagination: Pagination | null) => void
}

export function useQueueSync<T extends { id: string; status: string }>({
  entity,
  enabled,
  accessToken,
  statusFilter,
  page,
  pageSize,
  query,
  rows,
  setRows,
  pagination,
  setPagination,
}: UseQueueSyncOptions<T>): { pendingOnPage1: number; clearPending: () => void } {
  const { subscribe } = useLiveStream()
  const cursorRef = useRef('')
  const rowsRef = useRef(rows)
  const paginationRef = useRef(pagination)
  const [pendingOnPage1, setPendingOnPage1] = useState(0)

  rowsRef.current = rows
  paginationRef.current = pagination

  const queryKey = JSON.stringify(query)

  useEffect(() => {
    cursorRef.current = ''
    setPendingOnPage1(0)
  }, [statusFilter, page, pageSize, entity, queryKey])

  const pullChanges = useCallback(async () => {
    if (!accessToken || !enabled) return
    const params = new URLSearchParams()
    params.set('status', statusFilter)
    params.set('limit', String(CHANGES_LIMIT))
    if (cursorRef.current) params.set('cursor', cursorRef.current)
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue
      params.set(key, String(value))
    }

    const path = entity === 'payin' ? `/api/v1/payin/changes?${params}` : `/api/v1/utr/changes?${params}`
    const payload = await apiRequest<LiveChangesResponse<T>>(path, { token: accessToken })
    if (payload.cursor) cursorRef.current = payload.cursor

    const merged = mergeQueueRows({
      current: rowsRef.current,
      incoming: payload.items,
      statusFilter,
      page,
      pageSize,
      pagination: paginationRef.current,
    })
    setRows(merged.rows)
    setPagination(merged.pagination)
    setPendingOnPage1((count) => count + merged.pendingOnPage1)
  }, [accessToken, enabled, entity, page, pageSize, query, setPagination, setRows, statusFilter])

  useEffect(() => {
    if (!enabled || !accessToken) return
    const handleEvent = (event: LiveEventEnvelope) => {
      if (event.entity !== entity) return
      const applied = applyLiveEnvelope({
        rows: rowsRef.current,
        event,
        statusFilter,
        pagination: paginationRef.current,
      })
      setRows(applied.rows)
      setPagination(applied.pagination)
      if (applied.shouldPullChanges) {
        void pullChanges().catch(() => undefined)
      }
    }
    return subscribe(handleEvent)
  }, [enabled, accessToken, entity, pullChanges, setPagination, setRows, statusFilter, subscribe])

  const clearPending = useCallback(() => setPendingOnPage1(0), [])

  return { pendingOnPage1, clearPending }
}
