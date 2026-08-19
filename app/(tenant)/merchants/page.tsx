'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MerchantDetail, MerchantListItem, Pagination } from '@quickerpay/shared-types'
import { MERCHANT_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { IconButton } from '@/components/ui/IconButton'
import { Pencil, List, Ban } from 'lucide-react'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
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
  const [loading, setLoading] = useState(true)
  const [suspend, setSuspend] = useState<MerchantDetail | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.status) query.set('status', filters.status)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<MerchantListItem>(`/api/v1/merchants?${query}`)
      const details = await Promise.all(
        result.items.map((row) => apiRequest<MerchantDetail>(`/api/v1/merchants/${row.id}`)),
      )
      setRows(details)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.q])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSuspend = async () => {
    if (!accessToken || !suspend || submitting) return
    setSubmitting(true)
    try {
      await apiRequest(`/api/v1/merchants/${suspend.id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status: 'SUSPENDED' },
      })
      setSuspend(null)
      toast.success('Merchant suspended')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not suspend')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Merchants" role={user.role} menus={menus}>
      <PageHeader
        title="Merchants"
        action={
          hasMenu(menus, 'MERCHANTS', 'can_create') ? (
            <PrimaryButton href="/merchants/new">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Merchant
            </PrimaryButton>
          ) : null
        }
      />
      <FilterBar
        onApply={() => void load()}
        onClear={() => void setFilters({ status: '', q: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value, page: 1 })} aria-label="Status">
            <option value="">All statuses</option>
            {MERCHANT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input placeholder="code or name" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
      </FilterBar>
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
              <span className="flex items-center gap-1">
                <IconButton href={`/merchants/${row.id}`} icon={<Pencil size={15} strokeWidth={1.75} />} tooltip="Edit" />
                <IconButton href={`/transactions?merchant_id=${row.id}`} icon={<List size={15} strokeWidth={1.75} />} tooltip="View transactions" />
                {hasMenu(menus, 'MERCHANTS', 'can_edit') && row.status === 'ACTIVE' ? (
                  <IconButton variant="danger" icon={<Ban size={15} strokeWidth={1.75} />} tooltip="Suspend" onClick={() => setSuspend(row)} />
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
          loading={submitting}
          onCancel={() => setSuspend(null)}
          onConfirm={() => void handleSuspend()}
        />
      ) : null}
    </AppShell>
  )
}
