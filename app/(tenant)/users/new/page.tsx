'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MENU_CODES, PHASE_1_ADMIN_MENUS } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewUserPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'AUDITOR'>('ADMIN')
  const [payinBp, setPayinBp] = useState(350)
  const [payoutBp, setPayoutBp] = useState(150)
  const [selected, setSelected] = useState<string[]>([...PHASE_1_ADMIN_MENUS])
  const [error, setError] = useState<string | null>(null)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken) return
    setError(null)
    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        token: accessToken,
        body: {
          username,
          display_name: displayName || username,
          temporary_password: password,
          require_password_change: true,
          role,
          rates:
            role === 'ADMIN'
              ? [
                  { rate_kind: 'PAYIN', rate_bp: payinBp },
                  { rate_kind: 'PAYOUT', rate_bp: payoutBp },
                ]
              : undefined,
          menus: selected.map((code) => ({
            menu_code: code,
            can_view: true,
            can_create: code === 'PAYIN' || code === 'PAYOUT' || code === 'UTR' || code === 'BANKS' || code === 'USERS',
            can_edit: code === 'PAYIN' || code === 'PAYOUT' || code === 'UTR' || code === 'BANKS',
            can_approve: code === 'PAYIN',
            can_export: false,
          })),
        },
      })
      router.replace('/users')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create')
    }
  }

  return (
    <AppShell title="Create user" role={user.role} menus={menus}>
      <FormShell submitLabel="Create" error={error} onSubmit={() => void handleSubmit()}>
        <label className="block text-xs">Username<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label className="block text-xs">Display name<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="block text-xs">Temporary password<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="block text-xs">
          Role
          <select className="mt-0.5 h-7 w-full rounded border border-zinc-300" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="ADMIN">ADMIN</option>
            <option value="OPERATOR">OPERATOR</option>
            <option value="AUDITOR">AUDITOR</option>
          </select>
        </label>
        {role === 'ADMIN' ? (
          <>
            <label className="block text-xs">PAYIN rate (bp)<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="number" value={payinBp} onChange={(event) => setPayinBp(Number(event.target.value))} /></label>
            <label className="block text-xs">PAYOUT rate (bp)<input className="mt-0.5 h-7 w-full rounded border border-zinc-300 px-1" type="number" value={payoutBp} onChange={(event) => setPayoutBp(Number(event.target.value))} /></label>
          </>
        ) : null}
        <fieldset className="text-xs">
          <legend>Menus</legend>
          {MENU_CODES.map((code) => (
            <label key={code} className="mr-2 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={selected.includes(code)}
                onChange={(event) =>
                  setSelected(event.target.checked ? [...selected, code] : selected.filter((item) => item !== code))
                }
              />
              {code}
            </label>
          ))}
        </fieldset>
      </FormShell>
    </AppShell>
  )
}
