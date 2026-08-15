'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UpiAccountListItem, UtrListItem } from '@quickerpay/shared-types'
import { UTR_STATUSES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton, Toast } from '@/components/ui/FilterBar'
import { FormShell, InlineCreatePanel } from '@/components/forms/FormShell'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function UtrPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('UTR')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    status: parseAsString.withDefault('PENDING'),
    upi_account_id: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    extension_device_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UtrListItem[]>([])
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [amountMinor, setAmountMinor] = useState(0)
  const [utr, setUtr] = useState('')
  const [upiId, setUpiId] = useState('')
  const [confirm, setConfirm] = useState<{ id: string; action: 'verify' | 'reject' } | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    query.set('status', filters.status || 'PENDING')
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
    if (filters.q) query.set('q', filters.q)
    if (filters.extension_device_id) query.set('extension_device_id', filters.extension_device_id)
    try {
      const result = await apiListRequest<UtrListItem>(`/api/v1/utr?${query}`, { token: accessToken })
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    if (!ready || !allowed || !accessToken) return
    void load()
    void apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken }).then((result) => setUpis(result.items))
  }, [ready, allowed, accessToken, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const addedBy = (row: UtrListItem) => {
    if (row.source !== 'EXTENSION') return row.added_by_username ?? '—'
    const hint = [row.device_label, row.extension_device_id].filter(Boolean).join(' ')
    return (
      <span title={hint || 'extension device'} tabIndex={0}>
        BOT
      </span>
    )
  }

  const handleCreate = async () => {
    if (!accessToken) return
    await apiRequest('/api/v1/utr', {
      method: 'POST',
      token: accessToken,
      body: { amount_minor: amountMinor, utr, upi_account_id: upiId },
    })
    setCreating(false)
    setToast('Success')
    await load()
  }

  const handleAction = async () => {
    if (!confirm || !accessToken) return
    await apiRequest(`/api/v1/utr/${confirm.id}/${confirm.action}`, {
      method: 'POST',
      token: accessToken,
      headers: confirm.action === 'verify' ? { 'Idempotency-Key': crypto.randomUUID() } : undefined,
    })
    setConfirm(null)
    setToast('Success')
    await load()
  }

  return (
    <AppShell title="UTR Entries" role={user.role} menus={menus}>
      <Toast message={toast} />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: 'PENDING', upi_account_id: '', q: '', extension_device_id: '', page: 1 })} onReload={() => void load()}>
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.upi_account_id} onChange={(event) => void setFilters({ upi_account_id: event.target.value })} aria-label="UPI">
          <option value="">All UPIs</option>
          {upis.map((upi) => (
            <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
          ))}
        </select>
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.status} onChange={(event) => void setFilters({ status: event.target.value, page: 1 })} aria-label="Status">
          {UTR_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Gateway Ref. No / UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="device id" value={filters.extension_device_id} onChange={(event) => void setFilters({ extension_device_id: event.target.value, page: 1 })} aria-label="Extension device" />
        <ExportButton
          disabled={rows.length === 0}
          canExport={hasMenu(menus, 'UTR', 'can_export')}
          onExport={() => {
            const query = new URLSearchParams()
            query.set('status', filters.status || 'PENDING')
            if (filters.date_from) query.set('date_from', filters.date_from)
            if (filters.date_to) query.set('date_to', filters.date_to)
            if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
            if (filters.q) query.set('q', filters.q)
            return downloadExport(`/api/v1/utr/export?${query}`, accessToken)
          }}
        />
        {hasMenu(menus, 'UTR', 'can_create') ? (
          <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => setCreating(true)}>Add Entry</button>
        ) : null}
      </FilterBar>
      {creating ? (
        <InlineCreatePanel title="Add UTR Entry" onCancel={() => setCreating(false)}>
          <FormShell submitLabel="Add Entry" onSubmit={() => void handleCreate()}>
            <MoneyInput id="utr-amt" label="Amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
            <label className="text-xs">UTR<input className="ml-1 h-7 rounded border border-zinc-300 px-1" value={utr} onChange={(event) => setUtr(event.target.value)} /></label>
            <label className="text-xs">
              UPI ID
              <select className="ml-1 h-7 rounded border border-zinc-300" value={upiId} onChange={(event) => setUpiId(event.target.value)}>
                <option value="">Select</option>
                {upis.filter((row) => row.status === 'ACTIVE').map((upi) => (
                  <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                ))}
              </select>
            </label>
          </FormShell>
        </InlineCreatePanel>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
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
            status: <StatusBadge status={row.status} />,
            actions: hasMenu(menus, 'UTR', 'can_edit') && row.status === 'PENDING' ? (
              <span className="flex gap-1">
                <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'verify' })}>Verify</button>
                <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'reject' })}>Reject</button>
              </span>
            ) : null,
          }))}
          empty={<EmptyState message="No UTR entries found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? <ConfirmDialog title={`${confirm.action} this UTR?`} confirmLabel={confirm.action} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} /> : null}
    </AppShell>
  )
}
