'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TenantSettingsView } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function SettingsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('SETTINGS')
  const [settings, setSettings] = useState<TenantSettingsView | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken) return
    setSettings(await apiRequest<TenantSettingsView>('/api/v1/settings', { token: accessToken }))
  }, [accessToken])

  useEffect(() => {
    if (ready && allowed) void load().catch((caught) => {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    })
  }, [ready, allowed, load])

  const handleSave = async () => {
    if (!accessToken || !settings) return
    setError(null)
    setSaved(false)
    try {
      const next = await apiRequest<TenantSettingsView>('/api/v1/settings', {
        method: 'PATCH',
        token: accessToken,
        body: {
          require_banking_approval: settings.require_banking_approval,
          inter_transfer_approval_above_minor: settings.inter_transfer_approval_above_minor,
          allow_negative_margin: settings.allow_negative_margin,
          confirmation: confirmation || undefined,
        },
      })
      setSettings(next)
      setConfirmation('')
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not save')
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden
  if (!settings) return <p className="p-3 text-xs text-zinc-500">Loading</p>

  return (
    <AppShell title="Settings" role={user.role} menus={menus}>
      {saved ? <p className="mb-2 text-xs text-emerald-800">Saved</p> : null}
      <FormShell submitLabel="Save" error={error} onSubmit={() => void handleSave()}>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.require_banking_approval}
            onChange={(event) => setSettings({ ...settings, require_banking_approval: event.target.checked })}
          />
          Require banking approval
        </label>
        <label className="block text-xs">
          Inter transfer approval above (paise)
          <input
            className="ml-1 h-7 rounded border border-zinc-300 px-1"
            type="number"
            value={settings.inter_transfer_approval_above_minor}
            onChange={(event) => setSettings({ ...settings, inter_transfer_approval_above_minor: Number(event.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.allow_negative_margin}
            onChange={(event) => setSettings({ ...settings, allow_negative_margin: event.target.checked })}
          />
          Allow negative margin
        </label>
        {settings.allow_negative_margin ? (
          <label className="block text-xs">
            Type ALLOW_NEGATIVE_MARGIN to confirm
            <input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
        ) : null}
      </FormShell>
      <p className="mt-3 text-xs">
        <a className="underline" href="/settings/extension-devices">
          Extension devices
        </a>
      </p>
    </AppShell>
  )
}
