'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NavQueueCounts } from '@quickerpay/shared-types'
import { hasMenu, useSession } from '@/lib/session'

const POLL_MS = 30_000

const EMPTY: NavQueueCounts = {
  pending_deposit: null,
  pending_withdrawal: null,
  in_process_withdrawal: null,
}

/**
 * Sidebar open-queue badges. Skips Merchants and users without PAYIN/PAYOUT view.
 * Polls every 30s while the tab is visible.
 *
 * Uses fetch directly (not apiRequest) so a stuck `isRedirecting` SILENT promise
 * cannot leave badges empty forever while the rest of the console works.
 */
export function useNavQueueCounts(): NavQueueCounts {
  const { ready, user, menus, accessToken } = useSession()
  const [counts, setCounts] = useState<NavQueueCounts>(EMPTY)

  const role = user?.role
  const enabled =
    ready &&
    Boolean(accessToken) &&
    role !== undefined &&
    role !== 'MERCHANT' &&
    (hasMenu(menus, 'PAYIN', 'can_view') || hasMenu(menus, 'PAYOUT', 'can_view'))

  const load = useCallback(async () => {
    if (!enabled || !accessToken) {
      setCounts(EMPTY)
      return
    }
    try {
      const response = await fetch('/api/v1/nav/queue-counts', {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) return
      const body = (await response.json()) as {
        success?: boolean
        data?: NavQueueCounts
      }
      if (!body.success || !body.data) return
      setCounts({
        pending_deposit: body.data.pending_deposit ?? null,
        pending_withdrawal: body.data.pending_withdrawal ?? null,
        in_process_withdrawal: body.data.in_process_withdrawal ?? null,
      })
    } catch {
      // Keep last good counts; a transient failure must not blank the rail.
    }
  }, [enabled, accessToken])

  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY)
      return
    }

    let cancelled = false
    const tick = () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void load()
    }

    tick()
    const timer = setInterval(tick, POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, load])

  return counts
}

/** Format a queue count for the sidebar pill; hide zero / null. Cap at 99+. */
export function formatNavBadgeCount(value: number | null | undefined): string | null {
  if (value === null || value === undefined || value <= 0) return null
  if (value > 99) return '99+'
  return String(value)
}
