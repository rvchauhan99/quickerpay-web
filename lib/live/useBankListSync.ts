'use client'

import { useEffect, useRef } from 'react'
import { useLiveStream } from './LiveStreamProvider'

export function useBankListSync({
  enabled,
  onRefresh,
}: {
  enabled: boolean
  onRefresh: () => Promise<void>
}) {
  const { subscribe } = useLiveStream()
  const onRefreshRef = useRef(onRefresh)

  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!enabled) return

    return subscribe((event) => {
      if (event.entity !== 'bank_account') return
      if (event.action !== 'created' && event.action !== 'updated') return
      void onRefreshRef.current().catch(() => undefined)
    })
  }, [enabled, subscribe])
}
