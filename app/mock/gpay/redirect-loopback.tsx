'use client'

import { useEffect } from 'react'

/** Local cookies and the extension inject on localhost, not 127.0.0.1. */
export function RedirectLoopbackToLocalhost() {
  useEffect(() => {
    if (window.location.hostname !== '127.0.0.1') return
    const next = new URL(window.location.href)
    next.hostname = 'localhost'
    window.location.replace(next.toString())
  }, [])
  return null
}
