'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UserListItem } from '@quickerpay/shared-types'
import { USER_ROLES, USER_STATUSES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton, Toast } from '@/components/ui/FilterBar'
import { FormShell, InlineCreatePanel } from '@/components/forms/FormShell'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UsersPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [filters, setFilters] = useQueryStates({
    role: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UserListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.role) query.set('role', filters.role)
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<UserListItem>(`/api/v1/users?${query}`, { token: accessToken })
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleCreateOperator = async () => {
    if (!accessToken) return
    await apiRequest('/api/v1/users', {
      method: 'POST',
      token: accessToken,
      body: {
        username,
        display_name: username,
        temporary_password: password,
        require_password_change: true,
        role: 'OPERATOR',
        menus: [
          { menu_code: 'DASHBOARD', can_view: true },
          { menu_code: 'PAYIN', can_view: true, can_edit: true, can_approve: true },
          { menu_code: 'PAYOUT', can_view: true, can_edit: true },
          { menu_code: 'UTR', can_view: true, can_create: true, can_edit: true },
        ],
      },
    })
    setCreating(false)
    setToast('Success')
    await load()
  }

  const handleDisable = async (id: string) => {
    if (!accessToken) return
    await apiRequest(`/api/v1/users/${id}/status`, { method: 'POST', token: accessToken, body: { status: 'DISABLED' } })
    setToast('Success')
    await load()
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
      <Toast message={toast} />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ role: '', status: '', q: '', page: 1 })} onReload={() => void load()}>
        {isAdmin ? null : (
          <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.role} onChange={(event) => void setFilters({ role: event.target.value })} aria-label="Role">
            <option value="">All roles</option>
            {USER_ROLES.filter((role) => role !== 'SUPER_ADMIN').map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        )}
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        <ExportButton disabled={rows.length === 0} />
        {hasMenu(menus, 'USERS', 'can_create') ? (
          isAdmin ? (
            <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => setCreating(true)}>Create user</button>
          ) : (
            <Link className="h-7 rounded bg-zinc-900 px-2 text-xs leading-7 text-white" href="/users/new">Create user</Link>
          )
        ) : null}
      </FilterBar>
      {creating ? (
        <InlineCreatePanel title="Create Operator" onCancel={() => setCreating(false)}>
          <FormShell submitLabel="Create" onSubmit={() => void handleCreateOperator()}>
            <label className="text-xs">Username<input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
            <label className="text-xs">Temporary password<input className="ml-1 h-7 rounded border border-zinc-300 px-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          </FormShell>
        </InlineCreatePanel>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
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
              <span className="flex gap-2">
                <Link className="underline" href={`/users/${row.id}`}>View</Link>
                {hasMenu(menus, 'USERS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <button type="button" className="underline" onClick={() => void handleDisable(row.id)}>Disable</button>
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
