'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MenuCode, Pagination, UserListItem } from '@quickerpay/shared-types'
import { USER_ROLES, USER_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ExportButton, FilterBar, StatusBadge, TableSkeleton, DataTable, EmptyState } from '@/components/ui/FilterBar'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { FormShell } from '@/components/forms/FormShell'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, Ban } from 'lucide-react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UsersPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [filters, setFilters] = useQueryStates({
    role: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UserListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedModules, setSelectedModules] = useState<MenuCode[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isAdmin = user?.role === 'ADMIN'
  const offerableModules = menus.filter((grant) => grant.can_view && grant.menu_code !== 'USERS')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.role) query.set('role', filters.role)
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    try {
      const result = await apiListRequest<UserListItem>(`/api/v1/users?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.role, filters.status, filters.q, filters.merchant_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleCloseCreate = () => {
    setCreating(false)
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setSelectedModules([])
    setCreateError(null)
    setFieldErrors({})
  }

  const handleToggleModule = (code: MenuCode) => {
    setSelectedModules((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    )
  }

  const handleCreateOperator = async () => {
    if (!accessToken || submitting) return
    setCreateError(null)
    setFieldErrors({})
    if (selectedModules.length === 0) {
      setFieldErrors({ menus: 'Select at least one module' })
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        token: accessToken,
        body: {
          username,
          display_name: username,
          temporary_password: password,
          require_password_change: false,
          role: 'OPERATOR',
          menus: selectedModules.map((code) => {
            const grantor = menus.find((grant) => grant.menu_code === code)
            return {
              menu_code: code,
              can_view: true,
              can_create: Boolean(grantor?.can_create),
            }
          }),
        },
      })
      handleCloseCreate()
      toast.success('Operator created')
      await load()
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setFieldErrors(caught.fieldErrors())
        setCreateError(caught.displayMessage())
        return
      }
      setCreateError('Could not create operator')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async (id: string) => {
    if (!accessToken) return
    try {
      await apiRequest(`/api/v1/users/${id}/status`, { method: 'POST', token: accessToken, body: { status: 'DISABLED' } })
      toast.success('User disabled')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not disable user')
    }
  }

  const adminColumns = [
    { key: 'id', heading: 'ID' },
    { key: 'username', heading: 'USERNAME' },
    { key: 'menus', heading: 'ACCESS MODULES' },
    { key: 'actions', heading: 'ACTION' },
  ]
  const saColumns = [
    { key: 'username', heading: 'USERNAME' },
    { key: 'display', heading: 'DISPLAY NAME' },
    { key: 'role', heading: 'ROLE' },
    { key: 'supervisor', heading: 'SUPERVISOR' },
    { key: 'menus', heading: 'MENUS' },
    { key: 'scope', heading: 'SCOPE' },
    { key: 'status', heading: 'STATUS' },
    { key: 'ops', heading: 'ONLINE' },
    { key: 'actions', heading: 'ACTION' },
  ]

  return (
    <AppShell title="User Management" role={user.role} menus={menus}>
      <PageHeader
        title="User Management"
        action={
          hasMenu(menus, 'USERS', 'can_create') ? (
            isAdmin ? (
              <PrimaryButton onClick={() => setCreating(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Operator
              </PrimaryButton>
            ) : (
              <PrimaryButton href="/users/new">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create User
              </PrimaryButton>
            )
          ) : null
        }
      />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ role: '', status: '', q: '', merchant_id: '', page: 1 })} onReload={() => void load()}>
        {isAdmin ? null : (
          <FormField label="Role">
            <Select value={filters.role} onChange={(event) => void setFilters({ role: event.target.value })} aria-label="Role">
              <option value="">All roles</option>
              {USER_ROLES.filter((role) => role !== 'SUPER_ADMIN').map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            merchantId={filters.merchant_id}
            onMerchantChange={(value) => void setFilters({ merchant_id: value, page: 1 })}
            showAdmin={false}
          />
        ) : null}
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>
      {creating ? (
        <div className="mb-4">
          <FormShell
            submitLabel="Create"
            error={createError}
            onCancel={handleCloseCreate}
            onSubmit={() => void handleCreateOperator()}
          >
            <FormSection title="Create Operator" description="Add a new operator with limited access.">
              <FormGrid>
                <FormField label="Username" required error={fieldErrors.username}>
                  <Input
                    value={username}
                    autoComplete="off"
                    aria-label="Username"
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </FormField>
                <FormField
                  label="Password"
                  required
                  hint="6-20 chars, include uppercase + number + special character. They can change it later from Profile."
                  error={fieldErrors.temporary_password}
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      autoComplete="new-password"
                      aria-label="Password"
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold underline"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((open) => !open)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Select Modules" required error={fieldErrors.menus}>
                    <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-3" style={{ borderColor: 'var(--qp-border)' }}>
                      {offerableModules.map((grant) => (
                        <label
                          key={grant.menu_code}
                          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                          style={{ color: 'var(--qp-text-primary)' }}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={selectedModules.includes(grant.menu_code)}
                            onChange={() => handleToggleModule(grant.menu_code)}
                            aria-label={grant.menu_code.replaceAll('_', ' ')}
                          />
                          {grant.menu_code.replaceAll('_', ' ')}
                        </label>
                      ))}
                    </div>
                  </FormField>
                </div>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={isAdmin ? adminColumns : saColumns}
          rows={rows.map((row) => ({
            id: String(row.display_seq ?? '—'),
            username: row.username,
            display: row.display_name,
            role: row.role,
            supervisor: row.supervisor_username ?? '—',
            menus: isAdmin
              ? row.menus.filter((grant) => grant.can_view).map((grant) => grant.menu_code).join(', ')
              : String(row.menus.filter((grant) => grant.can_view).length),
            scope: String(row.scope_grant_count),
            status: <StatusBadge status={row.status} />,
            ops: row.operational_state,
            actions: (
              <span className="flex items-center gap-1">
                <IconButton href={`/users/${row.id}`} icon={<Eye size={15} strokeWidth={1.75} />} tooltip="View user" />
                {hasMenu(menus, 'USERS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <IconButton onClick={() => void handleDisable(row.id)} icon={<Ban size={15} strokeWidth={1.75} />} tooltip="Disable user" variant="danger" />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No users found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
    </AppShell>
  )
}
