'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UpiAccountListItem, UpiStatusHistoryItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, FilterBar, StatusBadge, TableSkeleton, EmptyState, ExportButton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { FormField } from '@/components/forms/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { History } from 'lucide-react'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UpiPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('UPI')
  const [filters, setFilters] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
    q: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
  })
  const [rows, setRows] = useState<UpiAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [history, setHistory] = useState<UpiStatusHistoryItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    try {
      const result = await apiListRequest<UpiAccountListItem>(`/api/v1/upi-accounts?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.q, filters.owner_user_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)
  const ownerOptions = user
    ? [{ id: user.id, username: user.username }, ...admins.filter((row) => row.id !== user.id)]
    : admins

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleHistory = async (id: string) => {
    if (!accessToken) return
    const items = await apiRequest<UpiStatusHistoryItem[]>(`/api/v1/upi-accounts/${id}/history`, { token: accessToken })
    setHistoryFor(id)
    setHistory(items)
  }

  return (
    <AppShell title="UPI" role={user.role} menus={menus}>
      <PageHeader
        title="UPI"
      />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ page: 1, q: '', owner_user_id: '' })} onReload={() => void load()}>
        <FormField label="Search">
          <Input placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={ownerOptions}
            merchants={merchants}
            adminId={filters.owner_user_id}
            onAdminChange={(value) => void setFilters({ owner_user_id: value, page: 1 })}
            showMerchant={false}
          />
        ) : null}
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'upi', heading: 'UPI' },
            { key: 'owner', heading: 'OWNER' },
            { key: 'bank', heading: 'BANK' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            upi: row.upi_address,
            owner: row.owner_username,
            bank: row.bank_label,
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex items-center gap-1">
                <IconButton icon={<History size={15} strokeWidth={1.75} />} tooltip="View history" onClick={() => void handleHistory(row.id)} />
              </span>
            ),
          }))}
          empty={<EmptyState message="No UPI accounts found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {historyFor ? (
        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
          <div className="mb-1 flex justify-between text-xs">
            <p>History</p>
            <button type="button" className="underline" onClick={() => setHistoryFor(null)}>Close</button>
          </div>
          <DataTable
            columns={[
              { key: 'when', heading: 'TIME' },
              { key: 'from', heading: 'FROM' },
              { key: 'to', heading: 'TO' },
              { key: 'reason', heading: 'REASON' },
            ]}
            rows={history.map((row) => ({
              when: new Date(row.created_at).toLocaleString(),
              from: row.from_status ?? '—',
              to: row.to_status,
              reason: row.reason ?? '—',
            }))}
            empty={<EmptyState message="No history" />}
          />
        </div>
      ) : null}
    </AppShell>
  )
}
