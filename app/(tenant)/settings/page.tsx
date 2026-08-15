'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TenantSettingsView } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
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
      <PageHeader title="Tenant Settings" />
      <div className="mb-4">
        {saved ? <ErrorAlert message="Settings saved successfully" type="success" /> : null}
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel="Save Settings" onSubmit={() => void handleSave()}>
        <FormSection title="Configuration" description="General platform rules and limits.">
          <FormGrid>
            <FormField label="Require banking approval">
              <div className="flex h-10 items-center px-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                  checked={settings.require_banking_approval}
                  onChange={(event) => setSettings({ ...settings, require_banking_approval: event.target.checked })}
                />
              </div>
            </FormField>
            <FormField label="Inter-transfer approval above (paise)">
              <Input
                type="number"
                value={settings.inter_transfer_approval_above_minor}
                onChange={(event) => setSettings({ ...settings, inter_transfer_approval_above_minor: Number(event.target.value) })}
              />
            </FormField>
            <FormField label="Allow negative margin">
              <div className="flex h-10 items-center px-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                  checked={settings.allow_negative_margin}
                  onChange={(event) => setSettings({ ...settings, allow_negative_margin: event.target.checked })}
                />
              </div>
            </FormField>
            {settings.allow_negative_margin ? (
              <FormField label="Type ALLOW_NEGATIVE_MARGIN to confirm" required>
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </FormField>
            ) : null}
          </FormGrid>
        </FormSection>
      </FormShell>
      <p className="mt-3 text-xs">
        <a className="underline" href="/settings/extension-devices">
          Extension devices
        </a>
      </p>
    </AppShell>
  )
}
