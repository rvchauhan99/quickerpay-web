'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { InterTransferListItem } from '@quickerpay/shared-types'
import { TRANSFER_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DirectionBadge } from '@/components/ui/DirectionBadge'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge } from '@/components/ui/FilterBar'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'

export default function InterTransfersPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [transferType, setTransferType] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<InterTransferListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'reject' | 'cancel' } | null>(null)
  const [utrFor, setUtrFor] = useState<string | null>(null)
  const [utr, setUtr] = useState('')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    const query = new URLSearchParams()
    if (dateFrom) query.set('date_from', dateFrom)
    if (dateTo) query.set('date_to', dateTo)
    if (transferType) query.set('transfer_type', transferType)
    if (q) query.set('q', q)
    query.set('page', String(page))
    query.set('page_size', String(pageSize))
    try {
      const result = await apiListRequest<InterTransferListItem>(`/api/v1/inter-transfers?${query.toString()}`, {
        token: accessToken,
      })
      setRows(result.items)
      setTotal(result.pagination.total)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load transfers')
    }
  }, [accessToken, dateFrom, dateTo, transferType, q, page, pageSize])

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!hasMenu(menus, 'INTER_TRANSFER')) return
    void load()
  }, [ready, user, menus, load, router])

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'INTER_TRANSFER')) return <ForbiddenPage permission="INTER_TRANSFER.can_view" />

  const handleAction = async () => {
    if (!confirm || !accessToken) return
    await apiRequest(`/api/v1/inter-transfers/${confirm.id}/${confirm.action}`, {
      method: 'POST',
      token: accessToken,
      body: confirm.action === 'reject' ? { reason: 'Rejected' } : undefined,
    })
    setConfirm(null)
    await load()
  }

  const handleAttachUtr = async () => {
    if (!utrFor || !accessToken) return
    await apiRequest(`/api/v1/inter-transfers/${utrFor}/utrs`, {
      method: 'POST',
      token: accessToken,
      body: { utr },
    })
    setUtrFor(null)
    setUtr('')
    await load()
  }

  const columns = isSuperAdmin
    ? [
        { key: 'created', heading: 'DATE & TIME' },
        { key: 'ref', heading: 'Gateway Ref. No' },
        { key: 'type', heading: 'TYPE' },
        { key: 'source', heading: 'SOURCE' },
        { key: 'dest', heading: 'DESTINATION' },
        { key: 'amount', heading: 'AMOUNT' },
        { key: 'utr', heading: 'UTR' },
        { key: 'status', heading: 'STATUS' },
        { key: 'actions', heading: '' },
      ]
    : [
        { key: 'created', heading: 'DATE & TIME' },
        { key: 'ref', heading: 'Gateway Ref. No' },
        { key: 'type', heading: 'TYPE' },
        { key: 'amount', heading: 'AMOUNT' },
        { key: 'remark', heading: 'REMARK' },
        { key: 'utr', heading: 'UTR' },
        { key: 'actions', heading: '' },
      ]

  return (
    <AppShell title="Inter Transfer" role={user.role} menus={menus}>
      <FilterBar onApply={() => void load()} onClear={() => { setDateFrom(''); setDateTo(''); setTransferType(''); setQ(''); void load() }} onReload={() => void load()}>
        <label className="text-xs text-zinc-600">
          Start Date
          <input className="ml-1 h-7 rounded border border-zinc-300 px-1" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-600">
          End Date
          <input className="ml-1 h-7 rounded border border-zinc-300 px-1" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        {isSuperAdmin ? (
          <label className="text-xs text-zinc-600">
            Type
            <select className="ml-1 h-7 rounded border border-zinc-300" value={transferType} onChange={(e) => setTransferType(e.target.value)}>
              <option value="">All</option>
              {TRANSFER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <input className="h-7 rounded border border-zinc-300 px-2 text-xs" placeholder="Reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Reference" />
        <ExportButton
          disabled={rows.length === 0}
          canExport={hasMenu(menus, 'INTER_TRANSFER', 'can_export')}
          onExport={() => {
            const query = new URLSearchParams()
            if (dateFrom) query.set('date_from', dateFrom)
            if (dateTo) query.set('date_to', dateTo)
            if (transferType) query.set('transfer_type', transferType)
            if (q) query.set('q', q)
            return downloadExport(`/api/v1/inter-transfers/export?${query}`, accessToken)
          }}
        />
        {isSuperAdmin && hasMenu(menus, 'INTER_TRANSFER', 'can_create') ? (
          <a className="h-7 rounded bg-zinc-900 px-2 text-xs leading-7 text-white" href="/inter-transfers/new">
            Create transfer
          </a>
        ) : null}
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      <DataTable
        columns={columns}
        rows={rows.map((row) => ({
          created: new Date(row.created_at).toLocaleString(),
          ref: row.reference,
          type: isSuperAdmin ? row.transfer_type : row.viewer_direction ? <DirectionBadge direction={row.viewer_direction} /> : '—',
          source: `${row.source_username} ${row.source_bank_label} ${row.source_account_masked ?? ''}`.trim(),
          dest: `${row.destination_username} ${row.destination_bank_label} ${row.destination_account_masked ?? ''}`.trim(),
          amount: <MoneyDisplay amountMinor={row.amount_minor} />,
          remark: row.remark ?? '—',
          utr: row.utrs.join(' / ') || '—',
          status: <StatusBadge status={row.status} />,
          actions: (
            <span className="flex gap-1">
              {isSuperAdmin && row.status === 'PENDING_APPROVAL' ? (
                <>
                  <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'approve' })}>
                    Approve
                  </button>
                  <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'reject' })}>
                    Reject
                  </button>
                </>
              ) : null}
              {row.status === 'PENDING_APPROVAL' || row.status === 'CREATED' ? (
                <button type="button" className="underline" onClick={() => setConfirm({ id: row.id, action: 'cancel' })}>
                  Cancel
                </button>
              ) : null}
              <button type="button" className="underline" onClick={() => setUtrFor(row.id)}>
                Attach UTR
              </button>
            </span>
          ),
        }))}
        empty={<EmptyState message="No inter transfers found" onClear={() => { setDateFrom(''); setDateTo(''); setTransferType(''); setQ(''); void load() }} />}
          pagination={{ page, page_size: pageSize, total }}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1) }}
        />
      {confirm ? (
        <ConfirmDialog
          title={`${confirm.action} this transfer?`}
          confirmLabel={confirm.action}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void handleAction()}
        />
      ) : null}
      {utrFor ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30" role="dialog" aria-label="Attach UTR">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-3">
            <label className="text-xs" htmlFor="attach-utr">
              UTR
              <input id="attach-utr" className="mt-1 h-8 w-full rounded border border-zinc-300 px-2 text-sm" value={utr} onChange={(e) => setUtr(e.target.value)} />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => setUtrFor(null)}>
                Cancel
              </button>
              <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={() => void handleAttachUtr()}>
                Attach
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}