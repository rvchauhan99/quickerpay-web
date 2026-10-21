'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { LiveEventEnvelope } from '@quickerpay/shared-types'
import { useSession } from '../session'

const FALLBACK_POLL_MS = 10_000
const MAX_SSE_RETRIES = 3
const FALLBACK_ENTITIES = ['payin', 'utr', 'payout'] as const

interface LiveStreamContextValue {
  lastSeq: string
  subscribe: (handler: (event: LiveEventEnvelope) => void) => () => void
}

const LiveStreamContext = createContext<LiveStreamContextValue | null>(null)

const fallbackTickBase = {
  seq: '0-0',
  action: 'updated' as const,
  id: '',
  status: '',
}

export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const { accessToken, ready } = useSession()
  const [lastSeq, setLastSeq] = useState('0-0')
  const handlersRef = useRef(new Set<(event: LiveEventEnvelope) => void>())
  const cursorRef = useRef('0-0')
  const retriesRef = useRef(0)

  const subscribe = useCallback((handler: (event: LiveEventEnvelope) => void) => {
    handlersRef.current.add(handler)
    return () => handlersRef.current.delete(handler)
  }, [])

  useEffect(() => {
    if (!ready || !accessToken) return

    let cancelled = false
    let isLeader = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let fallbackTimer: ReturnType<typeof setInterval> | undefined
    let abort: AbortController | undefined
    let releaseLock: (() => void) | undefined
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('qp-live') : null

    const dispatch = (event: LiveEventEnvelope) => {
      if (event.seq && event.seq !== '0-0') {
        cursorRef.current = event.seq
        setLastSeq(event.seq)
      }
      for (const handler of handlersRef.current) handler(event)
    }

    const fanout = (event: LiveEventEnvelope) => {
      dispatch(event)
      if (isLeader) channel?.postMessage(event)
    }

    const parseChunk = (buffer: string): string => {
      const parts = buffer.split('\n\n')
      const rest = parts.pop() ?? ''
      for (const block of parts) {
        const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        const json = dataLine.slice(5).trim()
        if (!json) continue
        try {
          const payload = JSON.parse(json) as { type?: string; event?: LiveEventEnvelope }
          if (payload.type === 'event' && payload.event) fanout(payload.event)
        } catch {
          // ignore malformed frames
        }
      }
      return rest
    }

    const startFallback = () => {
      if (!isLeader || fallbackTimer) return
      fallbackTimer = setInterval(() => {
        const updated_at = new Date().toISOString()
        for (const entity of FALLBACK_ENTITIES) {
          fanout({ ...fallbackTickBase, entity, updated_at })
        }
      }, FALLBACK_POLL_MS)
    }

    const connect = async () => {
      if (cancelled || !isLeader || document.hidden) return
      abort?.abort()
      abort = new AbortController()
      const signal = abort.signal

      try {
        const response = await fetch(`/api/v1/live/stream?cursor=${encodeURIComponent(cursorRef.current)}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            accept: 'text/event-stream',
            authorization: `Bearer ${accessToken}`,
          },
          signal,
        })
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`)
        retriesRef.current = 0
        if (fallbackTimer) {
          clearInterval(fallbackTimer)
          fallbackTimer = undefined
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let pending = ''
        while (!cancelled && !signal.aborted && isLeader) {
          const { done, value } = await reader.read()
          if (done) break
          pending = parseChunk(pending + decoder.decode(value, { stream: true }))
        }
        if (!cancelled && !signal.aborted && isLeader) {
          reconnectTimer = setTimeout(() => void connect(), 2_000)
        }
      } catch {
        if (cancelled || signal.aborted || !isLeader) return
        retriesRef.current += 1
        if (retriesRef.current >= MAX_SSE_RETRIES) startFallback()
        reconnectTimer = setTimeout(() => void connect(), 2_000)
      }
    }

    const handleVisibility = () => {
      if (!isLeader) return
      if (document.hidden) {
        abort?.abort()
        if (reconnectTimer) clearTimeout(reconnectTimer)
        return
      }
      void connect()
    }

    const onChannel = (message: MessageEvent<LiveEventEnvelope>) => {
      if (isLeader) return
      if (message.data?.entity) dispatch(message.data)
    }
    channel?.addEventListener('message', onChannel)

    const becomeLeader = () => {
      if (cancelled || isLeader) return
      isLeader = true
      document.addEventListener('visibilitychange', handleVisibility)
      void connect()
    }

    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (locks?.request) {
      void locks.request('qp-live', () => {
        becomeLeader()
        return new Promise<void>((resolve) => {
          releaseLock = resolve
        })
      })
    } else {
      becomeLeader()
    }

    return () => {
      cancelled = true
      isLeader = false
      abort?.abort()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (fallbackTimer) clearInterval(fallbackTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
      channel?.removeEventListener('message', onChannel)
      channel?.close()
      releaseLock?.()
    }
  }, [accessToken, ready])

  const value = useMemo(() => ({ lastSeq, subscribe }), [lastSeq, subscribe])

  return <LiveStreamContext.Provider value={value}>{children}</LiveStreamContext.Provider>
}

export function useLiveStream(): LiveStreamContextValue {
  const value = useContext(LiveStreamContext)
  if (!value) throw new Error('useLiveStream must be used inside LiveStreamProvider')
  return value
}
