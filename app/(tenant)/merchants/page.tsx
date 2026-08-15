'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MerchantDetail, MerchantListItem, Pagination } from '@quickerpay/shared-types'
import { MERCHANT_STATUSES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton, Toast } from '@/components/ui/FilterBar'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { RateDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

function openBp(rates: MerchantDetail['rates'], kind: 'PAYIN' | 'PAYOUT'): number | undefined {
  return rates.find((row) => row.rate_kind === kind)?.rate_bp
}

export default function MerchantsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const [filters, setFilters] = useQueryStates({
    status: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<MerchantDetail[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [suspend, setSuspend] = useState<MerchantDetail | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<MerchantListItem>(`/api/v1/merchants?${query}`, { token: accessToken })
      const details = await Promise.all(
        result.items.map((row) => apiRequest<MerchantDetail>(`/api/v1/merchants/${row.id}`, { token: accessToken })),
      )
      setRows(details)
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

  const handleSuspend = async () => {
    if (!accessToken || !suspend) return
    await apiRequest(`/api/v1/merchants/${suspend.id}/status`, {
      method: 'POST',
      token: accessToken,
      body: { status: 'SUSPENDED' },
    })
    setSuspend(null)
    setToast('Success')
    await load()
  }

  return (
    <AppShell title="Merchants" role={user.role} menus={menus}>
      <Toast message={toast} />
      <FilterBar
        onApply={() => void load()}
        onClear={() => void setFilters({ status: '', q: '', page: 1 })}
        onReload={() => void load()}
      >
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.status} onChange={(event) => void setFilters({ status: event.target.value, page: 1 })} aria-label="Status">
          <option value="">All statuses</option>
          {MERCHANT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="code or name" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        {hasMenu(menus, 'MERCHANTS', 'can_create') ? (
          <Link className="h-7 rounded bg-zinc-900 px-2 text-xs leading-7 text-white" href="/merchants/new">
            Create
          </Link>
        ) : null}
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={[
            { key: 'code', heading: 'CODE' },
            { key: 'name', heading: 'LEGAL NAME' },
            { key: 'payin', heading: 'PAYIN RATE' },
            { key: 'payout', heading: 'PAYOUT RATE' },
            { key: 'status', heading: 'STATUS' },
            { key: 'created', heading: 'CREATED' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            code: row.merchant_code,
            name: row.legal_name,
            payin: <RateDisplay rateBp={openBp(row.rates, 'PAYIN')} />,
            payout: <RateDisplay rateBp={openBp(row.rates, 'PAYOUT')} />,
            status: <StatusBadge status={row.status} />,
            created: new Date(row.created_at).toLocaleString(),
            actions: (
              <span className="flex gap-2">
                <Link className="underline" href={`/merchants/${row.id}`}>
                  Edit
                </Link>
                <Link className="underline" href={`/transactions?merchant_id=${row.id}`}>
                  View transactions
                </Link>
                {hasMenu(menus, 'MERCHANTS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <button type="button" className="underline" onClick={() => setSuspend(row)}>
                    Suspend
                  </button>
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No merchants found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {suspend ? (
        <ConfirmDialog
          title={`Suspend ${suspend.legal_name}?`}
          confirmLabel="Suspend"
          onCancel={() => setSuspend(null)}
          onConfirm={() => void handleSuspend()}
        />
      ) : null}
    </AppShell>
  )
}
