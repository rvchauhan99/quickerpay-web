'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UpiAccountListItem, UtrListItem } from '@quickerpay/shared-types'
import { UTR_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { IconButton } from '@/components/ui/IconButton'
import { Unlock, X } from 'lucide-react'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'
import { useQueueSync } from '@/lib/live/useQueueSync'

export default function UtrPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('UTR')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    status: parseAsString.withDefault('PENDING'),
    upi_account_id: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    banker_user_id: parseAsString.withDefault(''),
    extension_device_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UtrListItem[]>([])
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'reject' | 'release' } | null>(null)
  const [unclaimedBanner, setUnclaimedBanner] = useState<{ count: number; amount_minor: number } | null>(null)

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.status) query.set('status', filters.status)
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
    if (filters.q) query.set('q', filters.q)
    if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
    if (filters.extension_device_id) query.set('extension_device_id', filters.extension_device_id)
    try {
      const result = await apiListRequest<UtrListItem>(`/api/v1/utr?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      if (options?.silent) return
      toast.error(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.upi_account_id, filters.q, filters.banker_user_id, filters.extension_device_id])

  const { pendingOnPage1 } = useQueueSync({
    entity: 'utr',
    enabled: ready && allowed,
    accessToken,
    statusFilter: filters.status || 'PENDING',
    page: filters.page,
    pageSize: filters.page_size,
    query: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      upi_account_id: filters.upi_account_id || undefined,
      q: filters.q || undefined,
      banker_user_id: filters.banker_user_id || undefined,
      extension_device_id: filters.extension_device_id || undefined,
    },
    rows,
    setRows,
    pagination,
    setPagination,
  })

  useEffect(() => {
    if (!ready || !allowed || !accessToken) return
    void load()
    void apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken })
      .then((result) => setUpis(result.items))
      .catch((caught) => {
        toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load UPI accounts')
      })
  }, [ready, allowed, accessToken, load])

  useEffect(() => {
    if (!ready || !allowed || !accessToken) return
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
      setUnclaimedBanner(null)
      return
    }
    void apiRequest<{ unclaimed_utrs: number; unclaimed_amount_minor: number }>(
      '/api/v1/dashboard/summary',
      { token: accessToken },
    )
      .then((summary) => {
        if (summary.unclaimed_utrs > 0) {
          setUnclaimedBanner({ count: summary.unclaimed_utrs, amount_minor: summary.unclaimed_amount_minor })
        } else {
          setUnclaimedBanner(null)
        }
      })
      .catch(() => setUnclaimedBanner(null))
  }, [ready, allowed, accessToken, user?.role, load])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)
  const utrUpis = user?.role === 'BANKER' ? upis.filter((upi) => upi.owner_user_id === user.id) : upis

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const canRelease =
    (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && hasMenu(menus, 'UTR', 'can_edit')

  const addedBy = (row: UtrListItem) => {
    if (row.source !== 'EXTENSION') return row.added_by_username ?? '—'
    const hint = [row.device_label, row.extension_device_id].filter(Boolean).join(' ')
    return (
      <span title={hint || 'extension device'} tabIndex={0}>
        BOT
      </span>
    )
  }

  const handleAction = async () => {
    if (!confirm || !accessToken || submitting) return
    setSubmitting(confirm.id)
    try {
      const headers =
        confirm.action === 'release'
          ? { 'Idempotency-Key': `utr-release-${confirm.id}-${Date.now()}` }
          : undefined
      await apiRequest(`/api/v1/utr/${confirm.id}/${confirm.action}`, {
        method: 'POST',
        token: accessToken,
        headers,
      })
      setConfirm(null)
      toast.success(confirm.action === 'release' ? 'UTR released for Manual Accept' : 'UTR rejected')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update UTR')
      setConfirm(null)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <AppShell title="Banker UTR Entries" role={user.role} menus={menus}>
      <PageHeader title="Banker UTR Entries" />
      <p className="mb-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        UTR entries are recorded from bank transactions via the extension (BOT). Manual Add on this screen
        is not allowed.
      </p>
      {unclaimedBanner ? (
        <div className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {unclaimedBanner.count} unclaimed UTR{unclaimedBanner.count === 1 ? '' : 's'} (
          <MoneyDisplay amountMinor={unclaimedBanner.amount_minor} />
          ). Release on this screen before Manual Accept on Pay-In.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void setFilters({ status: 'UNCLAIMED', page: 1 })}
            aria-label="Filter unclaimed UTRs"
          >
            Show unclaimed
          </button>
        </div>
      ) : null}
      {pendingOnPage1 > 0 && filters.page > 1 ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pendingOnPage1} new UTR entr{pendingOnPage1 === 1 ? 'y' : 'ies'} on page 1.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void setFilters({ page: 1 })}
            aria-label="Go to page 1"
          >
            Go to page 1
          </button>
        </div>
      ) : null}
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: 'PENDING', upi_account_id: '', q: '', banker_user_id: '', extension_device_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="UPI">
          <Select value={filters.upi_account_id} onChange={(event) => void setFilters({ upi_account_id: event.target.value })} aria-label="UPI">
            <option value="">All UPIs</option>
            {utrUpis.map((upi) => (
              <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {UTR_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
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
            adminId={filters.banker_user_id}
            onAdminChange={(value) => void setFilters({ banker_user_id: value, page: 1 })}
            showMerchant={false}
          />
        ) : null}
        <FormField label="Device">
          <Input placeholder="device id" value={filters.extension_device_id} onChange={(event) => void setFilters({ extension_device_id: event.target.value })} aria-label="Extension device" />
        </FormField>
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'UTR', 'can_export')}
            onExport={() => {
              const query = new URLSearchParams()
              if (filters.status) query.set('status', filters.status)
              if (filters.date_from) query.set('date_from', filters.date_from)
              if (filters.date_to) query.set('date_to', filters.date_to)
              if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
              if (filters.q) query.set('q', filters.q)
              if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
              if (filters.extension_device_id) query.set('extension_device_id', filters.extension_device_id)
              void downloadExport(`/api/v1/utr/export?${query}`, 'utrs.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>

      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'amount', heading: 'AMOUNT' },
            { key: 'utr', heading: 'UTR' },
            { key: 'upi', heading: 'UPI' },
            { key: 'ref', heading: 'Gateway Ref. No' },
            { key: 'added', heading: 'ADDED BY' },
            { key: 'entry', heading: 'ENTRY TIME' },
            { key: 'actionTime', heading: 'ACTION TIME' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            utr: row.utr,
            upi: row.upi_address ?? '—',
            ref: row.reference ?? '—',
            added: addedBy(row),
            entry: new Date(row.entry_time).toLocaleString(),
            actionTime: row.action_time ? new Date(row.action_time).toLocaleString() : '—',
            status: (
              <span className="flex flex-col gap-0.5">
                <StatusBadge status={row.status} />
                {row.status === 'UNCLAIMED' && row.released_at ? (
                  <span className="text-[10px] text-zinc-500">Released — Manual Accept on Pay-In</span>
                ) : null}
              </span>
            ),
            actions:
              row.status === 'PENDING' && hasMenu(menus, 'UTR', 'can_edit') ? (
                <span className="flex items-center gap-1">
                  <IconButton
                    variant="danger"
                    icon={<X size={15} strokeWidth={1.75} />}
                    tooltip="Reject"
                    onClick={() => setConfirm({ id: row.id, action: 'reject' })}
                  />
                </span>
              ) : row.status === 'UNCLAIMED' && !row.released_at && canRelease ? (
                <span className="flex items-center gap-1">
                  <IconButton
                    variant="primary"
                    icon={<Unlock size={15} strokeWidth={1.75} />}
                    tooltip="Release"
                    onClick={() => setConfirm({ id: row.id, action: 'release' })}
                  />
                </span>
              ) : null,
          }))}
          empty={<EmptyState message="No UTR entries found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? (
        <ConfirmDialog
          title={confirm.action === 'release' ? 'Release this unclaimed UTR?' : 'Reject this UTR?'}
          confirmLabel={confirm.action === 'release' ? 'Release' : 'Reject'}
          loading={submitting === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void handleAction()}
        />
      ) : null}
    </AppShell>
  )
}
