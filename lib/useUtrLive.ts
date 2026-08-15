'use client'

import { useEffect, useRef } from 'react'

const POLL_MS = 3000

/** Silent GET /utr while the tab is visible so extension posts appear without a full reload. */
export function useUtrLive(accessToken: string | null, onPing: () => void): void {
  const onPingRef = useRef(onPing)
  onPingRef.current = onPing

  useEffect(() => {
    if (!accessToken) return
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const stopPoll = () => {
      if (!pollTimer) return
      clearInterval(pollTimer)
      pollTimer = undefined
    }

    const startPoll = () => {
      if (pollTimer || document.hidden) return
      pollTimer = setInterval(() => onPingRef.current(), POLL_MS)
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPoll()
        return
      }
      startPoll()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    startPoll()

    return () => {
      stopPoll()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [accessToken])
}
