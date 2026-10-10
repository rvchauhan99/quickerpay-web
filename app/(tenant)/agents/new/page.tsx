'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PasswordInput } from '@/components/forms/PasswordInput'
import { apiRequest, ApiClientError } from '@/lib/api'
import { agentLabel } from '@/lib/labels'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function NewAgentPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const canCreate =
    allowed &&
    (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') &&
    hasMenu(menus, 'USERS', 'can_create')

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!canCreate) return Forbidden

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      const created = await apiRequest<{ id: string }>('/api/v1/agents', {
        method: 'POST',
        token: accessToken,
        body: {
          username,
          display_name: displayName || username,
          email: email.trim() || undefined,
          mobile: mobile.trim() || undefined,
          temporary_password: password,
          require_password_change: true,
        },
      })
      router.replace(`/agents/${created.id}`)
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setFieldErrors(caught.fieldErrors())
        setError(caught.displayMessage())
        return
      }
      setError('Could not create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title={`New ${agentLabel()}`} role={user.role} menus={menus}>
      <FormShell
        title={`New ${agentLabel()}`}
        error={error}
        loading={submitting}
        onCancel={() => router.push('/agents')}
        onSubmit={() => void handleSubmit()}
      >
        <FormSection title="Identity">
          <FormGrid>
            <FormField label="Username" error={fieldErrors.username} required>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </FormField>
            <FormField label="Display name" error={fieldErrors.display_name}>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </FormField>
            <FormField label="Email" error={fieldErrors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Mobile" error={fieldErrors.mobile}>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </FormField>
            <FormField label="Temporary password" error={fieldErrors.temporary_password} required>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
