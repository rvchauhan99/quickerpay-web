'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UserListItem } from '@quickerpay/shared-types'
import { USER_STATUSES } from '@quickerpay/shared-types'
import { roleLabel } from '@/lib/labels'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ExportButton, FilterBar, StatusBadge, TableSkeleton, DataTable, EmptyState } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pencil, Ban, CircleCheck } from 'lucide-react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function BankersPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const [filters, setFilters] = useQueryStates({
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UserListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusTarget, setStatusTarget] = useState<{ id: string; username: string; next: 'ACTIVE' | 'DISABLED' } | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    query.set('role', 'BANKER')
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<UserListItem>(`/api/v1/users?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.q])

  useEffect(() => {
    if (ready && allowed && isSuperAdmin) void load()
  }, [ready, allowed, isSuperAdmin, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden
  if (!isSuperAdmin) return <ForbiddenPage permission="Banker Master (Super Admin only)" />

  const handleConfirmStatus = async () => {
    if (!accessToken || !statusTarget || statusSubmitting) return
    setStatusSubmitting(true)
    try {
      await apiRequest(`/api/v1/users/${statusTarget.id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status: statusTarget.next },
      })
      toast.success(statusTarget.next === 'DISABLED' ? 'Banker deactivated' : 'Banker activated')
      setStatusTarget(null)
      await load()
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.displayMessage()
          : statusTarget.next === 'DISABLED'
            ? 'Could not deactivate banker'
            : 'Could not activate banker',
      )
    } finally {
      setStatusSubmitting(false)
    }
  }

  const columns = [
    { key: 'username', heading: 'USERNAME' },
    { key: 'display', heading: 'DISPLAY NAME' },
    { key: 'role', heading: 'ROLE' },
    { key: 'menus', heading: 'MENUS' },
    { key: 'scope', heading: 'SCOPE' },
    { key: 'status', heading: 'STATUS' },
    { key: 'ops', heading: 'ONLINE' },
    { key: 'actions', heading: 'ACTION' },
  ]

  return (
    <AppShell title="Banker Master" role={user.role} menus={menus}>
      <PageHeader
        title="Banker Master"
        action={
          hasMenu(menus, 'USERS', 'can_create') ? (
            <PrimaryButton href="/bankers/new">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Banker
            </PrimaryButton>
          ) : null
        }
      />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ status: '', q: '', page: 1 })} onReload={() => void load()}>
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
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>
      <div className="mb-qp-gap">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={columns}
          rows={rows.map((row) => ({
            username: row.username,
            display: row.display_name,
            role: roleLabel(row.role),
            menus: String(row.menus.filter((grant) => grant.can_view).length),
            scope: String(row.scope_grant_count),
            status: <StatusBadge status={row.status} />,
            ops: row.operational_state,
            actions: (
              <span className="flex items-center gap-1">
                <IconButton href={`/users/${row.id}`} icon={<Pencil size={15} strokeWidth={1.75} />} tooltip="Edit banker" />
                {hasMenu(menus, 'USERS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <IconButton
                    onClick={() => setStatusTarget({ id: row.id, username: row.username, next: 'DISABLED' })}
                    icon={<Ban size={15} strokeWidth={1.75} />}
                    tooltip="Deactivate banker"
                    variant="danger"
                  />
                ) : null}
                {hasMenu(menus, 'USERS', 'can_edit') && row.status === 'DISABLED' ? (
                  <IconButton
                    onClick={() => setStatusTarget({ id: row.id, username: row.username, next: 'ACTIVE' })}
                    icon={<CircleCheck size={15} strokeWidth={1.75} />}
                    tooltip="Activate banker"
                    variant="primary"
                  />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No bankers found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {statusTarget ? (
        <ConfirmDialog
          title={statusTarget.next === 'DISABLED' ? `Deactivate ${statusTarget.username}?` : `Activate ${statusTarget.username}?`}
          subtitle={
            statusTarget.next === 'DISABLED'
              ? 'Their sessions end, they are forced offline, and every ACTIVE bank they own is disabled. They cannot go Online until you activate them again.'
              : 'They can sign in again. Banks stay disabled until enabled by hand, same as coming back Online after Offline.'
          }
          confirmLabel={statusTarget.next === 'DISABLED' ? 'Deactivate' : 'Activate'}
          variant={statusTarget.next === 'DISABLED' ? 'danger' : 'primary'}
          loading={statusSubmitting}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => void handleConfirmStatus()}
        />
      ) : null}
    </AppShell>
  )
}
