'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, TransactionListItem } from '@quickerpay/shared-types'
import { TRANSACTION_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, FilterBar, StatusBadge, TableSkeleton, EmptyState, ExportButton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
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
    admin_user_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<TransactionListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
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
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
    try {
      const result = await apiListRequest<TransactionListItem>(`/api/v1/transactions?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.date_from, filters.date_to, filters.type, filters.status, filters.q, filters.merchant_id, filters.admin_user_id])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  return (
    <AppShell title="Transactions" role={user.role} menus={menus}>
      <PageHeader
        title="Transactions"
      />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', type: '', status: '', q: '', merchant_id: '', admin_user_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="Type">
          <Select value={filters.type} onChange={(event) => void setFilters({ type: event.target.value })} aria-label="Type">
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input placeholder="Gateway Ref. No / UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            adminId={filters.admin_user_id}
            merchantId={filters.merchant_id}
            onAdminChange={(value) => void setFilters({ admin_user_id: value, page: 1 })}
            onMerchantChange={(value) => void setFilters({ merchant_id: value, page: 1 })}
          />
        ) : null}
        <div>
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
              if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
              if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
              void downloadExport(`/api/v1/transactions/export?${query}`, 'transactions.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'ref', heading: 'Gateway Ref. No' },
            { key: 'type', heading: 'TYPE' },
            { key: 'when', heading: 'CREATED' },
            { key: 'admin', heading: 'ADMIN' },
            { key: 'username', heading: 'USERNAME' },
            { key: 'amount', heading: 'AMOUNT' },
            { key: 'status', heading: 'STATUS' },
            { key: 'utr', heading: 'UTR' },
          ]}
          rows={rows.map((row) => ({
            ref: <Link className="underline" href={`/transactions/${row.id}`}>{row.reference}</Link>,
            type: row.type,
            when: new Date(row.created_at).toLocaleString(),
            admin: row.admin_username ?? '—',
            username: row.customer_ref?.trim() || '—',
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
