'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { Pagination, UpiAccountListItem, UtrListItem } from '@quickerpay/shared-types'
import { UTR_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { FormShell } from '@/components/forms/FormShell'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { IconButton } from '@/components/ui/IconButton'
import { X } from 'lucide-react'
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
    admin_user_id: parseAsString.withDefault(''),
    extension_device_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<UtrListItem[]>([])
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [amountMinor, setAmountMinor] = useState(0)
  const [utr, setUtr] = useState('')
  const [upiId, setUpiId] = useState('')
  const [confirm, setConfirm] = useState<{ id: string; action: 'reject' } | null>(null)

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
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
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
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.upi_account_id, filters.q, filters.admin_user_id, filters.extension_device_id])

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
      admin_user_id: filters.admin_user_id || undefined,
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

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

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
    if (!accessToken || submitting) return
    setSubmitting('create')
    try {
      await apiRequest('/api/v1/utr', {
        method: 'POST',
        token: accessToken,
        body: { amount_minor: amountMinor, utr, upi_account_id: upiId },
      })
      setCreating(false)
      toast.success('UTR added')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not add UTR')
    } finally {
      setSubmitting(null)
    }
  }

  const handleAction = async () => {
    if (!confirm || !accessToken || submitting) return
    setSubmitting(confirm.id)
    try {
      await apiRequest(`/api/v1/utr/${confirm.id}/${confirm.action}`, {
        method: 'POST',
        token: accessToken,
      })
      setConfirm(null)
      toast.success(`UTR ${confirm.action}ed`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update UTR')
      setConfirm(null)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <AppShell title="UTR Entries" role={user.role} menus={menus}>
      <PageHeader
        title="UTR Entries"
        action={
          hasMenu(menus, 'UTR', 'can_create') ? (
            <PrimaryButton onClick={() => setCreating(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add UTR
            </PrimaryButton>
          ) : null
        }
      />
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
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: '', upi_account_id: '', q: '', admin_user_id: '', extension_device_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="UPI">
          <Select value={filters.upi_account_id} onChange={(event) => void setFilters({ upi_account_id: event.target.value })} aria-label="UPI">
            <option value="">All UPIs</option>
            {upis.map((upi) => (
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
            adminId={filters.admin_user_id}
            onAdminChange={(value) => void setFilters({ admin_user_id: value, page: 1 })}
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
              if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
              if (filters.extension_device_id) query.set('extension_device_id', filters.extension_device_id)
              void downloadExport(`/api/v1/utr/export?${query}`, 'utrs.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>

      {creating ? (
        <div className="mb-4">
          <FormShell submitLabel="Add" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Add Manual UTR" description="Manually record a UTR to force reconciliation.">
              <FormGrid>
                <FormField label="Bank/UPI Account" required>
                  <Select value={upiId} onChange={(event) => setUpiId(event.target.value)}>
                    <option value="" disabled>Select account</option>
                    {upis.map((upi) => (
                      <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="UTR Number" required>
                  <Input value={utr} onChange={(event) => setUtr(event.target.value)} />
                </FormField>
                <FormField label="Amount">
                  <MoneyInput id="amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

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
              <span className="flex items-center gap-1">
                <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Reject" onClick={() => setConfirm({ id: row.id, action: 'reject' })} />
              </span>
            ) : null,
          }))}
          empty={<EmptyState message="No UTR entries found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? <ConfirmDialog title={`${confirm.action} this UTR?`} confirmLabel={confirm.action} loading={submitting === confirm.id} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} /> : null}
    </AppShell>
  )
}
