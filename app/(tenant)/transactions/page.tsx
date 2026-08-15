'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, TransactionListItem } from '@quickerpay/shared-types'
import { TRANSACTION_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { apiListRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function TransactionsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('TRANSACTIONS')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    type: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<TransactionListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.type) query.set('type', filters.type)
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    try {
      const result = await apiListRequest<TransactionListItem>(`/api/v1/transactions?${query}`, { token: accessToken })
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

  return (
    <AppShell title="Transactions" role={user.role} menus={menus}>
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', type: '', status: '', q: '', merchant_id: '', page: 1 })} onReload={() => void load()}>
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.type} onChange={(event) => void setFilters({ type: event.target.value })} aria-label="Type">
          <option value="">All types</option>
          {TRANSACTION_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Gateway Ref. No / UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        <ExportButton
          disabled={rows.length === 0}
          canExport={hasMenu(menus, 'TRANSACTIONS', 'can_export')}
          onExport={() => {
            const query = new URLSearchParams()
            if (filters.date_from) query.set('date_from', filters.date_from)
            if (filters.date_to) query.set('date_to', filters.date_to)
            if (filters.type) query.set('type', filters.type)
            if (filters.status) query.set('status', filters.status)
            if (filters.q) query.set('q', filters.q)
            return downloadExport(`/api/v1/transactions/export?${query}`, accessToken)
          }}
        />
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'ref', heading: 'Gateway Ref. No' },
            { key: 'type', heading: 'TYPE' },
            { key: 'when', heading: 'CREATED' },
            { key: 'admin', heading: 'ADMIN' },
            { key: 'amount', heading: 'AMOUNT' },
            { key: 'status', heading: 'STATUS' },
            { key: 'utr', heading: 'UTR' },
          ]}
          rows={rows.map((row) => ({
            ref: <Link className="underline" href={`/transactions/${row.id}`}>{row.reference}</Link>,
            type: row.type,
            when: new Date(row.created_at).toLocaleString(),
            admin: row.admin_username ?? '—',
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            status: <StatusBadge status={row.status} />,
            utr: row.utr ?? '—',
          }))}
          empty={<EmptyState message="No transactions found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
    </AppShell>
  )
}
