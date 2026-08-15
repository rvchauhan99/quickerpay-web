'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, PayoutListItem } from '@quickerpay/shared-types'
import { PAYOUT_STATUSES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton, Toast } from '@/components/ui/FilterBar'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayoutPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    status: parseAsString.withDefault('IN_PROCESS'),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<PayoutListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'process' | 'fail' | 'reject' | 'cancel' | 'retry' } | null>(null)
  const [successFor, setSuccessFor] = useState<string | null>(null)
  const [utr, setUtr] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    query.set('status', filters.status || 'IN_PROCESS')
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.q) query.set('q', filters.q)
    try {
      const result = await apiListRequest<PayoutListItem>(`/api/v1/payout?${query}`, { token: accessToken })
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

  const handleAction = async () => {
    if (!confirm || !accessToken) return
    await apiRequest(`/api/v1/payout/${confirm.id}/${confirm.action}`, {
      method: 'POST',
      token: accessToken,
      body: confirm.action === 'fail' || confirm.action === 'reject' ? { reason: 'Rejected' } : undefined,
    })
    setConfirm(null)
    setToast('Success')
    await load()
  }

  const handleSuccess = async () => {
    if (!successFor || !accessToken) return
    await apiRequest(`/api/v1/payout/${successFor}/success`, {
      method: 'POST',
      token: accessToken,
      body: { utr },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    setSuccessFor(null)
    setUtr('')
    setToast('Success')
    await load()
  }

  return (
    <AppShell title="Pay-Out Requests" role={user.role} menus={menus}>
      <Toast message={toast} />
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: 'IN_PROCESS', q: '', page: 1 })} onReload={() => void load()}>
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        <input className="h-7 rounded border border-zinc-300 px-1 text-xs" type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        <select className="h-7 rounded border border-zinc-300 text-xs" value={filters.status} onChange={(event) => void setFilters({ status: event.target.value, page: 1 })} aria-label="Status">
          {PAYOUT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Gateway Ref. No / UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        <ExportButton
          disabled={rows.length === 0}
          canExport={hasMenu(menus, 'PAYOUT', 'can_export')}
          onExport={() => {
            const query = new URLSearchParams()
            query.set('status', filters.status || 'IN_PROCESS')
            if (filters.date_from) query.set('date_from', filters.date_from)
            if (filters.date_to) query.set('date_to', filters.date_to)
            if (filters.q) query.set('q', filters.q)
            return downloadExport(`/api/v1/payout/export?${query}`, accessToken)
          }}
        />
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'ref', heading: 'Gateway Ref. No' },
            { key: 'utr', heading: 'UTR' },
            { key: 'inprog', heading: 'IN PROGRESS TIME' },
            { key: 'actionTime', heading: 'ACTION TIME' },
            { key: 'amount', heading: 'AMOUNT' },
            { key: 'type', heading: 'TYPE' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            ref: row.reference,
            utr: row.utr ?? '—',
            inprog: row.in_progress_at ? new Date(row.in_progress_at).toLocaleString() : '—',
            actionTime: row.action_at ? new Date(row.action_at).toLocaleString() : '—',
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            type: 'PAYOUT',
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex flex-wrap gap-1">
                <a className="underline" href={`/payout/${row.id}`}>View</a>
                {hasMenu(menus, 'PAYOUT', 'can_approve') && row.status === 'PENDING' ? (
                  <>
                    <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'approve' })}>Approve</button>
                    <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'reject' })}>Reject</button>
                  </>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && row.status === 'IN_PROCESS' ? (
                  <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'process' })}>Process</button>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && row.status === 'PROCESSING' ? (
                  <>
                    <button type="button" className="underline" onClick={() => setSuccessFor(row.id)}>Success</button>
                    <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'fail' })}>Fail</button>
                  </>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && row.status === 'FAILED' ? (
                  <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'retry' })}>Retry</button>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && ['CREATED', 'PENDING'].includes(row.status) ? (
                  <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'cancel' })}>Cancel</button>
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No Pay-Out requests found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? <ConfirmDialog title={`${confirm.action} this pay-out?`} confirmLabel={confirm.action} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} /> : null}
      {successFor ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30" role="dialog" aria-label="Mark success">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-3">
            <label className="text-xs" htmlFor="payout-utr">
              UTR
              <input id="payout-utr" className="mt-1 h-8 w-full rounded border border-zinc-300 px-2" value={utr} onChange={(event) => setUtr(event.target.value)} />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => setSuccessFor(null)}>Cancel</button>
              <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => void handleSuccess()}>Confirm</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
