'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { InterTransferListItem } from '@quickerpay/shared-types'
import { TRANSFER_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DirectionBadge } from '@/components/ui/DirectionBadge'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { Check, X, XCircle, Paperclip } from 'lucide-react'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'

export default function InterTransfersPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [transferType, setTransferType] = useState('')
  const [q, setQ] = useState('')
  const [sourceUserId, setSourceUserId] = useState('')
  const [rows, setRows] = useState<InterTransferListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'reject' | 'cancel' } | null>(null)
  const [utrFor, setUtrFor] = useState<string | null>(null)
  const [utr, setUtr] = useState('')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const { admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    const query = new URLSearchParams()
    if (dateFrom) query.set('date_from', dateFrom)
    if (dateTo) query.set('date_to', dateTo)
    if (transferType) query.set('transfer_type', transferType)
    if (q) query.set('q', q)
    if (sourceUserId) query.set('source_user_id', sourceUserId)
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
  }, [accessToken, dateFrom, dateTo, transferType, q, sourceUserId, page, pageSize])

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
      <PageHeader
        title="Inter Transfer"
        action={
          hasMenu(menus, 'INTER_TRANSFER', 'can_create') ? (
            <PrimaryButton href="/inter-transfers/new">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Transfer
            </PrimaryButton>
          ) : null
        }
      />
      <FilterBar onApply={() => void load()} onClear={() => { setDateFrom(''); setDateTo(''); setTransferType(''); setQ(''); setSourceUserId(''); void load() }} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="End Date" />
        </FormField>
        {isSuperAdmin ? (
          <FormField label="Type">
            <Select value={transferType} onChange={(e) => setTransferType(e.target.value)} aria-label="Type">
              <option value="">All Types</option>
              {TRANSFER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            adminId={sourceUserId}
            onAdminChange={setSourceUserId}
            showMerchant={false}
          />
        ) : null}
        <FormField label="Reference">
          <Input placeholder="Reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Reference" />
        </FormField>
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'INTER_TRANSFER', 'can_export')}
            onExport={() => void downloadExport(`/api/v1/inter-transfers/export?${new URLSearchParams({ date_from: dateFrom, date_to: dateTo, transfer_type: transferType, q, ...(sourceUserId ? { source_user_id: sourceUserId } : {}) }).toString()}`, 'inter-transfers.csv', accessToken!)}
          />
        </div>
      </FilterBar>
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
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
              <span className="flex items-center gap-1">
                {isSuperAdmin && row.status === 'PENDING_APPROVAL' ? (
                  <>
                    <IconButton variant="primary" icon={<Check size={15} strokeWidth={1.75} />} tooltip="Approve" onClick={() => setConfirm({ id: row.id, action: 'approve' })} />
                    <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Reject" onClick={() => setConfirm({ id: row.id, action: 'reject' })} />
                  </>
                ) : null}
                {row.status === 'PENDING_APPROVAL' || row.status === 'CREATED' ? (
                  <IconButton variant="secondary" icon={<XCircle size={15} strokeWidth={1.75} />} tooltip="Cancel" onClick={() => setConfirm({ id: row.id, action: 'cancel' })} />
                ) : null}
                <IconButton icon={<Paperclip size={15} strokeWidth={1.75} />} tooltip="Attach UTR" onClick={() => setUtrFor(row.id)} />
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
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-label="Attach UTR">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white">
            <FormShell title="Attach UTR" submitLabel="Attach" onCancel={() => { setUtrFor(null); setUtr(''); }} onSubmit={() => void handleAttachUtr()}>
              <FormField label="UTR Number" required>
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
              </FormField>
            </FormShell>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}