'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { useSession } from '@/lib/session'

export function HeaderToggles() {
  const { user, accessToken, logout, refreshUser } = useSession()
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const showAutoAccept = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const showOnline = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'OPERATOR'

  const handleAutoAccept = async () => {
    if (!accessToken) return
    const next = !user.auto_accept_enabled
    try {
      await apiRequest('/api/v1/users/me/auto-accept', {
        method: 'PATCH',
        token: accessToken,
        body: { auto_accept_enabled: next },
      })
      await refreshUser()
    } catch {
      setError('Auto Accept could not be updated')
    }
  }

  const handleOnline = async () => {
    if (!accessToken) return
    const next = user.operational_state === 'ONLINE' ? 'OFFLINE' : 'ONLINE'
    try {
      await apiRequest('/api/v1/users/me/operational-state', {
        method: 'PATCH',
        token: accessToken,
        body: { operational_state: next },
      })
      await refreshUser()
    } catch {
      setError('Online could not be updated')
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {error ? <span className="text-red-700">{error}</span> : null}
      {showAutoAccept ? (
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-0.5"
          aria-label="Auto Accept"
          onClick={() => void handleAutoAccept()}
        >
          Auto Accept [{user.auto_accept_enabled ? 'ON' : 'OFF'}]
        </button>
      ) : null}
      {showOnline ? (
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-0.5"
          aria-label="Online"
          onClick={() => void handleOnline()}
        >
          Online [{user.operational_state === 'ONLINE' ? 'ON' : 'OFF'}]
        </button>
      ) : null}
      <a className="font-medium uppercase underline" href="/profile">
        {user.display_name}
      </a>
      <span className="text-[10px] uppercase text-zinc-500">{user.role.replaceAll('_', ' ')}</span>
      <button type="button" className="text-zinc-500 underline" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  )
}
