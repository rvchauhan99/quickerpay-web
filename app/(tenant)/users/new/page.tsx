'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { MenuCode, UserListItem } from '@quickerpay/shared-types'
import { clampMenuGrant, preferredGrantForMenu } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { PhoneInput, splitE164 } from '@/components/forms/PhoneInput'
import { ModuleMultiSelect } from '@/components/forms/ModuleMultiSelect'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { bankerLabel, roleLabel } from '@/lib/labels'
import { offerableMenus } from '@/lib/menus'
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
  const [supervisorId, setSupervisorId] = useState('')
  const [bankers, setBankers] = useState<UserListItem[]>([])
  const [supervisorMenus, setSupervisorMenus] = useState<UserListItem['menus'] | null>(null)
  const [selected, setSelected] = useState<MenuCode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const clippedMenus = useMemo(
    () =>
      offerableMenus({
        actorMenus: menus,
        targetRole: role,
        supervisorMenus: role === 'OPERATOR' ? supervisorMenus : null,
      }),
    [menus, role, supervisorMenus],
  )

  useEffect(() => {
    const defaults = STAFF_DEFAULT_MENUS[role].filter((code) => clippedMenus.includes(code))
    setSelected(defaults.length > 0 ? defaults : clippedMenus.slice(0, 1))
  }, [role, clippedMenus])

  useEffect(() => {
    if (!accessToken || user?.role !== 'SUPER_ADMIN') return
    void apiListRequest<UserListItem>('/api/v1/users?role=BANKER&status=ACTIVE&page_size=100', {
      token: accessToken,
    })
      .then((page) => setBankers(page.items))
      .catch(() => setBankers([]))
  }, [accessToken, user?.role])

  useEffect(() => {
    if (role !== 'OPERATOR' || !supervisorId || !accessToken) {
      setSupervisorMenus(null)
      return
    }
    const cached = bankers.find((row) => row.id === supervisorId)
    if (cached) {
      setSupervisorMenus(cached.menus)
      return
    }
    void apiRequest<UserListItem>(`/api/v1/users/${supervisorId}`, { token: accessToken })
      .then((row) => setSupervisorMenus(row.menus))
      .catch(() => setSupervisorMenus([]))
  }, [role, supervisorId, accessToken, bankers])

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
      if (role === 'OPERATOR' && user.role === 'SUPER_ADMIN' && !supervisorId) {
        setFieldErrors({ supervisor_banker_id: `Select a supervising ${bankerLabel()}` })
        setError(`An Operator needs a supervising ${bankerLabel()}`)
        return
      }
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
          ...(role === 'OPERATOR' && supervisorId ? { supervisor_banker_id: supervisorId } : {}),
          menus: selected.map((code) => {
            const grantor = menus.find((grant) => grant.menu_code === code)
            const desired = preferredGrantForMenu(role, code)
            const afterActor = clampMenuGrant(role, code, desired, grantor)
            if (role !== 'OPERATOR' || !supervisorMenus) {
              return { menu_code: code, ...afterActor }
            }
            const supervisor = supervisorMenus.find((grant) => grant.menu_code === code)
            return {
              menu_code: code,
              ...clampMenuGrant(role, code, afterActor, supervisor),
            }
          }),
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
              hint="At least 6 characters"
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
              <Select
                value={role}
                onChange={(event) => {
                  const next = event.target.value as StaffCreatableRole
                  setRole(next)
                  if (next !== 'OPERATOR') setSupervisorId('')
                }}
                aria-label="Role"
              >
                {creatableRoles.map((code) => (
                  <option key={code} value={code}>{roleLabel(code)}</option>
                ))}
              </Select>
            </FormField>
            {role === 'OPERATOR' && user.role === 'SUPER_ADMIN' ? (
              <FormField
                label={`Supervising ${bankerLabel()}`}
                required
                error={fieldErrors.supervisor_banker_id}
              >
                <Select
                  value={supervisorId}
                  onChange={(event) => setSupervisorId(event.target.value)}
                  aria-label={`Supervising ${bankerLabel()}`}
                >
                  <option value="">{`Select ${bankerLabel()}`}</option>
                  {bankers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.username}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
          </FormGrid>
        </FormSection>

        <FormSection
          title="Menus"
          {...(role === 'AUDITOR'
            ? { description: 'Auditor menus are view and export only — write actions are not offered.' }
            : role === 'OPERATOR'
              ? {
                  description: `Only modules you hold (and the supervising ${bankerLabel()} holds) are offered. Operators cannot receive Banks or Hawala.`,
                }
              : { description: 'Only menus you hold yourself are offered.' })}
        >
          <ModuleMultiSelect offerable={clippedMenus} selected={selected} onChange={setSelected} />
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
