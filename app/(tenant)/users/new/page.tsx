'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { MenuCode } from '@quickerpay/shared-types'
import { menusForRole, preferredGrantForMenu } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { PhoneInput, splitE164 } from '@/components/forms/PhoneInput'
import { apiRequest, ApiClientError } from '@/lib/api'
import { roleLabel } from '@/lib/labels'
import { useTenantScreen } from '@/lib/useTenantScreen'

type StaffCreatableRole = 'ADMIN' | 'OPERATOR' | 'AUDITOR'

const STAFF_DEFAULT_MENUS: Record<StaffCreatableRole, MenuCode[]> = {
  ADMIN: ['DASHBOARD', 'USERS', 'LEDGER', 'PAYIN', 'PAYOUT', 'UTR', 'HAWALA'],
  OPERATOR: ['DASHBOARD', 'PAYIN', 'PAYOUT', 'UTR'],
  AUDITOR: ['DASHBOARD', 'PAYIN', 'PAYOUT', 'UTR', 'TRANSACTIONS', 'LEDGER', 'AUDIT'],
}

export default function NewUserPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffCreatableRole>('ADMIN')
  const [selected, setSelected] = useState<MenuCode[]>([...STAFF_DEFAULT_MENUS.ADMIN])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const offerableMenus = useMemo(() => menusForRole(role), [role])

  useEffect(() => {
    const defaults = STAFF_DEFAULT_MENUS[role].filter((code) => offerableMenus.includes(code))
    setSelected(defaults.length > 0 ? defaults : offerableMenus.slice(0, 1))
  }, [role, offerableMenus])

  if (!ready || !user) return <p className="p-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>Loading</p>
  if (!allowed) return Forbidden

  const creatableRoles: StaffCreatableRole[] =
    user.role === 'SUPER_ADMIN' ? ['ADMIN', 'OPERATOR', 'AUDITOR'] : ['OPERATOR']

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setFieldErrors({})
    setSubmitting(true)
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
          mobile: splitE164(mobile).national ? mobile.trim() : undefined,
          menus: selected.map((code) => ({
            menu_code: code,
            ...preferredGrantForMenu(role, code),
          })),
        },
      })
      router.replace('/users')
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
    <AppShell title="Create user" role={user.role} menus={menus}>
      <FormShell
        title="Create User"
        wide
        compact
        submitLabel={submitting ? 'Creating…' : 'Create'}
        error={error}
        onSubmit={() => void handleSubmit()}
        onCancel={() => router.back()}
      >
        {user.role === 'SUPER_ADMIN' ? (
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            Create Admin, Operator, or Auditor here.{' '}
            <Link href="/bankers/new" className="font-medium underline underline-offset-2" style={{ color: 'var(--qp-primary)' }}>
              Create Banker → Banker Master
            </Link>
          </p>
        ) : null}
        <FormSection title="Account & Role">
          <FormGrid>
            <FormField label="Username" required error={fieldErrors.username}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} aria-label="Username" />
            </FormField>
            <FormField label="Display name" required error={fieldErrors.display_name}>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-label="Display name"
              />
            </FormField>
            <FormField
              label="Contact number"
              error={fieldErrors.mobile}
              hint="Optional."
            >
              <PhoneInput
                value={mobile}
                onChange={setMobile}
                aria-label="Contact number"
              />
            </FormField>
            <FormField
              label="Temporary password"
              required
              hint="6-20 chars, uppercase + number + special"
              error={fieldErrors.temporary_password}
            >
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-label="Temporary password"
              />
            </FormField>
            <FormField label="Role" required>
              <Select value={role} onChange={(event) => setRole(event.target.value as StaffCreatableRole)} aria-label="Role">
                {creatableRoles.map((code) => (
                  <option key={code} value={code}>{roleLabel(code)}</option>
                ))}
              </Select>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Menus"
          {...(role === 'AUDITOR'
            ? { description: 'Auditor menus are view and export only — write actions are not offered.' }
            : role === 'OPERATOR'
              ? { description: 'Operator menus follow the Operator ceiling (no Banks or Hawala).' }
              : {})}
        >
          <div className="flex flex-wrap gap-2">
            {offerableMenus.map((code) => {
              const on = selected.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  data-on={on ? 'true' : 'false'}
                  className="qp-menu-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={{
                    backgroundColor: on ? 'var(--qp-primary)' : 'var(--qp-card)',
                    color: on ? '#ffffff' : 'var(--qp-text-secondary)',
                    border: `1px solid ${on ? 'var(--qp-primary)' : 'var(--qp-border)'}`,
                    boxShadow: on ? '0 1px 3px 0 rgba(37, 99, 235, 0.2)' : 'none',
                  }}
                  onClick={() =>
                    setSelected((prev) => (on ? prev.filter((row) => row !== code) : [...prev, code]))
                  }
                >
                  {on ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : null}
                  {code.replaceAll('_', ' ')}
                </button>
              )
            })}
          </div>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
