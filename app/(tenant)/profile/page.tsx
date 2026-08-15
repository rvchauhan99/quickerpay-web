'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (ready && !user) {
    router.replace('/login')
  }
  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>

  const handleSubmit = async () => {
    if (!accessToken) return
    setError(null)
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        token: accessToken,
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not change password')
    }
  }

  return (
    <AppShell title="Profile" role={user.role} menus={menus}>
      <p className="mb-2 text-xs text-zinc-600">
        {user.username} · {user.role === 'SUPER_ADMIN' ? '2FA required' : '2FA not required for this role'}
      </p>
      {done ? (
        <p className="text-xs">Password changed. Sign in again.</p>
      ) : (
        <FormShell submitLabel="Change password" error={error} onSubmit={() => void handleSubmit()}>
          <label className="block text-xs">
            Current password
            <input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="block text-xs">
            New password
            <input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
        </FormShell>
      )}
    </AppShell>
  )
}
