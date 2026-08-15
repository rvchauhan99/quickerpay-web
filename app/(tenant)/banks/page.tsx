'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, Pagination } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton, Toast } from '@/components/ui/FilterBar'
import { FormShell, InlineCreatePanel } from '@/components/forms/FormShell'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function BanksPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('BANKS')
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<BankAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [upiAddress, setUpiAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<BankAccountListItem>(`/api/v1/bank-accounts?${query}`, { token: accessToken })
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

  const handleCreate = async () => {
    if (!accessToken) return
    await apiRequest('/api/v1/bank-accounts', {
      method: 'POST',
      token: accessToken,
      body: { upi_address: upiAddress, display_name: displayName },
    })
    setCreating(false)
    setToast('Success')
    await load()
  }

  const handleReveal = async (id: string) => {
    if (!accessToken) return
    const result = await apiRequest<{ account_number: string }>(`/api/v1/bank-accounts/${id}/reveal`, {
      method: 'POST',
      token: accessToken,
    })
    setRevealed((current) => ({ ...current, [id]: result.account_number }))
  }

  return (
    <AppShell title="Bank Details" role={user.role} menus={menus}>
      <Toast message={toast} />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ q: '', page: 1 })} onReload={() => void load()}>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        <ExportButton disabled={rows.length === 0} />
        {hasMenu(menus, 'BANKS', 'can_create') ? (
          <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => setCreating(true)}>Create</button>
        ) : null}
      </FilterBar>
      {creating ? (
        <InlineCreatePanel title="UPI-first bank" onCancel={() => setCreating(false)}>
          <FormShell submitLabel="Create" onSubmit={() => void handleCreate()}>
            <label className="text-xs">UPI address<input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={upiAddress} onChange={(event) => setUpiAddress(event.target.value)} /></label>
            <label className="text-xs">Display name<input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          </FormShell>
        </InlineCreatePanel>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'owner', heading: 'OWNER' },
            { key: 'label', heading: 'LABEL' },
            { key: 'masked', heading: 'ACCOUNT' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            owner: row.owner_username,
            label: row.label,
            masked: revealed[row.id] ?? row.account_number_masked ?? '—',
            status: <StatusBadge status={row.status} />,
            actions: (
              <button type="button" className="underline" onClick={() => void handleReveal(row.id)}>Reveal</button>
            ),
          }))}
          empty={<EmptyState message="No bank accounts found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
    </AppShell>
  )
}
