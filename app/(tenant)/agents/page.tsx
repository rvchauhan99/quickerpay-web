'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination } from '@quickerpay/shared-types'
import { USER_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Pencil, Ban, CircleCheck } from 'lucide-react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { agentLabel } from '@/lib/labels'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface AgentListItem {
  id: string
  username: string
  display_name: string
  status: string
  exchange_count: number
  created_at: string
}

export default function AgentsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('USERS')
  const canManage =
    allowed && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && hasMenu(menus, 'USERS', 'can_view')

  const [filters, setFilters] = useQueryStates({
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<AgentListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusTarget, setStatusTarget] = useState<{
    id: string
    username: string
    next: 'ACTIVE' | 'DISABLED'
  } | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<AgentListItem>(`/api/v1/agents?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Could not load',
      )
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.q])

  useEffect(() => {
    if (ready && canManage) void load()
  }, [ready, canManage, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!canManage) return Forbidden

  const handleStatus = async () => {
    if (!accessToken || !statusTarget || statusSubmitting) return
    setStatusSubmitting(true)
    try {
      await apiRequest(`/api/v1/agents/${statusTarget.id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status: statusTarget.next },
      })
      toast.success(
        statusTarget.next === 'ACTIVE'
          ? `${agentLabel()} activated`
          : `${agentLabel()} disabled`,
      )
      setStatusTarget(null)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setStatusSubmitting(false)
    }
  }

  return (
    <AppShell title={agentLabel({ plural: true })} role={user.role} menus={menus}>
      <PageHeader
        title={agentLabel({ plural: true })}
        action={
          hasMenu(menus, 'USERS', 'can_create') ? (
            <PrimaryButton href="/agents/new">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New {agentLabel()}
            </PrimaryButton>
          ) : null
        }
      />
      {error ? <ErrorAlert message={error} /> : null}
      <FilterBar
        onApply={() => void load()}
        onClear={() => void setFilters({ status: '', q: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Status">
          <Select
            value={filters.status}
            onChange={(event) => void setFilters({ status: event.target.value, page: 1 })}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input
            placeholder="username or name"
            value={filters.q}
            onChange={(event) => void setFilters({ q: event.target.value })}
            aria-label="Search"
          />
        </FormField>
      </FilterBar>
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'username', heading: 'USERNAME' },
            { key: 'name', heading: 'NAME' },
            { key: 'exchanges', heading: 'EXCHANGES' },
            { key: 'status', heading: 'STATUS' },
            { key: 'created', heading: 'CREATED' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            username: row.username,
            name: row.display_name,
            exchanges: row.exchange_count,
            status: <StatusBadge status={row.status} />,
            created: new Date(row.created_at).toLocaleString(),
            actions: (
              <span className="flex items-center gap-1">
                <IconButton href={`/agents/${row.id}`} icon={<Pencil size={15} strokeWidth={1.75} />} tooltip="Edit" />
                {hasMenu(menus, 'USERS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <IconButton
                    variant="danger"
                    icon={<Ban size={15} strokeWidth={1.75} />}
                    tooltip="Disable"
                    onClick={() => setStatusTarget({ id: row.id, username: row.username, next: 'DISABLED' })}
                  />
                ) : null}
                {hasMenu(menus, 'USERS', 'can_edit') && row.status !== 'ACTIVE' ? (
                  <IconButton
                    variant="primary"
                    icon={<CircleCheck size={15} strokeWidth={1.75} />}
                    tooltip="Activate"
                    onClick={() => setStatusTarget({ id: row.id, username: row.username, next: 'ACTIVE' })}
                  />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message={`No ${agentLabel({ plural: true }).toLowerCase()} found`} />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {statusTarget ? (
        <ConfirmDialog
          title={`${statusTarget.next === 'ACTIVE' ? 'Activate' : 'Disable'} ${statusTarget.username}?`}
          subtitle={
            statusTarget.next === 'ACTIVE'
              ? 'The Agent can sign in again and see linked Exchange data.'
              : 'Sessions are revoked. Linked Exchanges keep their Agent assignment until cleared.'
          }
          confirmLabel={statusTarget.next === 'ACTIVE' ? 'Activate' : 'Disable'}
          loading={statusSubmitting}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => void handleStatus()}
        />
      ) : null}
    </AppShell>
  )
}
