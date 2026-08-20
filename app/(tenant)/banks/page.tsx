'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  Pagination,
  UpiAccountListItem,
  UpiStatusHistoryItem,
} from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { DataTable, FilterBar, StatusBadge, TableSkeleton, EmptyState, ExportButton } from '@/components/ui/FilterBar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Ban, CircleCheck, History, ScrollText, Trash2 } from 'lucide-react'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { FormShell } from '@/components/forms/FormShell'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { useBankListSync } from '@/lib/live/useBankListSync'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface HistoryRow extends UpiStatusHistoryItem {
  upi_address: string
}

export default function BanksPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('BANKS')
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<BankAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [upiAddress, setUpiAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [closeTarget, setCloseTarget] = useState<BankAccountListItem | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])

  const canEdit = hasMenu(menus, 'BANKS', 'can_edit')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    if (filters.status) query.set('status', filters.status)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    try {
      const result = await apiListRequest<BankAccountListItem>(`/api/v1/bank-accounts?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.q, filters.status, filters.owner_user_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useBankListSync({ enabled: ready && allowed, onRefresh: load })

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)
  const ownerOptions = user
    ? [{ id: user.id, username: user.username }, ...admins.filter((row) => row.id !== user.id)]
    : admins

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleCreate = async () => {
    if (!accessToken || submitting) return
    setSubmitting('create')
    try {
      await apiRequest('/api/v1/bank-accounts', {
        method: 'POST',
        token: accessToken,
        body: { upi_address: upiAddress, display_name: displayName },
      })
      setCreating(false)
      toast.success('Bank account added')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not create')
    } finally {
      setSubmitting(null)
    }
  }

  const handleStatus = async (id: string, status: 'ACTIVE' | 'DISABLED') => {
    if (!accessToken || submitting) return
    setSubmitting(id)
    try {
      await apiRequest(`/api/v1/bank-accounts/${id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status },
      })
      toast.success(status === 'DISABLED' ? 'Account disabled' : 'Account enabled')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setSubmitting(null)
    }
  }

  const handleClose = async () => {
    if (!accessToken || !closeTarget || submitting) return
    setSubmitting(closeTarget.id)
    try {
      await apiRequest(`/api/v1/bank-accounts/${closeTarget.id}/close`, {
        method: 'POST',
        token: accessToken,
        body: { reason: 'Closed from Bank Details' },
      })
      setCloseTarget(null)
      toast.success('Account closed')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not close')
    } finally {
      setSubmitting(null)
    }
  }

  const handleHistory = async (row: BankAccountListItem) => {
    if (!accessToken) return
    try {
      const upis = await apiListRequest<UpiAccountListItem>(
        `/api/v1/upi-accounts?bank_account_id=${row.id}&page_size=25`,
        { token: accessToken },
      )
      const entries: HistoryRow[] = []
      for (const upi of upis.items) {
        const items = await apiRequest<UpiStatusHistoryItem[]>(`/api/v1/upi-accounts/${upi.id}/history`, {
          token: accessToken,
        })
        for (const item of items) {
          entries.push({ ...item, upi_address: upi.upi_address })
        }
      }
      entries.sort((left, right) => right.created_at.localeCompare(left.created_at))
      setHistoryFor(row.label)
      setHistory(entries)
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load history')
    }
  }

  return (
    <AppShell title="Bank Details" role={user.role} menus={menus}>
      <PageHeader
        title="Bank Details"
        action={
          hasMenu(menus, 'BANKS', 'can_create') ? (
            <PrimaryButton onClick={() => setCreating(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Bank
            </PrimaryButton>
          ) : null
        }
      />
      <FilterBar
        onApply={() => void load()}
        onClear={() => void setFilters({ q: '', status: '', owner_user_id: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Search">
          <Input placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        <FormField label="Status">
          <Select
            value={filters.status}
            onChange={(event) => void setFilters({ status: event.target.value, page: 1 })}
            aria-label="Status"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
            <option value="CLOSED">CLOSED</option>
          </Select>
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={ownerOptions}
            merchants={merchants}
            adminId={filters.owner_user_id}
            onAdminChange={(value) => void setFilters({ owner_user_id: value, page: 1 })}
            showMerchant={false}
          />
        ) : null}
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>

      {creating ? (
        <div className="mb-4">
          <FormShell submitLabel="Add" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Add UPI-First Bank" description="Register a new UPI ID as a target for payouts or collections.">
              <FormGrid>
                <FormField label="UPI Address" required>
                  <Input value={upiAddress} onChange={(event) => setUpiAddress(event.target.value)} />
                </FormField>
                <FormField label="Display Name">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'owner', heading: 'OWNER' },
            { key: 'label', heading: 'LABEL' },
            { key: 'upi', heading: 'UPI ID' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            owner: row.owner_username,
            label: row.label,
            upi: row.upi_address ?? '—',
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex items-center gap-1">
                {canEdit && row.status === 'ACTIVE' ? (
                  <IconButton
                    icon={<Ban size={15} strokeWidth={1.75} />}
                    tooltip="Disable"
                    onClick={() => void handleStatus(row.id, 'DISABLED')}
                  />
                ) : null}
                {canEdit && row.status === 'DISABLED' ? (
                  <IconButton
                    icon={<CircleCheck size={15} strokeWidth={1.75} />}
                    tooltip="Enable"
                    variant="primary"
                    onClick={() => void handleStatus(row.id, 'ACTIVE')}
                  />
                ) : null}
                <IconButton
                  icon={<History size={15} strokeWidth={1.75} />}
                  tooltip="View history"
                  onClick={() => void handleHistory(row)}
                />
                <IconButton
                  icon={<ScrollText size={15} strokeWidth={1.75} />}
                  tooltip="Transactions History"
                  href={`/banks/${row.id}/history`}
                />
                {canEdit && row.status !== 'CLOSED' && row.status !== 'REJECTED' ? (
                  <IconButton
                    icon={<Trash2 size={15} strokeWidth={1.75} />}
                    tooltip="Delete"
                    variant="danger"
                    onClick={() => setCloseTarget(row)}
                  />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No bank accounts found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {historyFor ? (
        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
          <div className="mb-1 flex justify-between text-xs">
            <p>History — {historyFor}</p>
            <button type="button" className="underline" onClick={() => setHistoryFor(null)}>Close</button>
          </div>
          <DataTable
            columns={[
              { key: 'upi', heading: 'UPI' },
              { key: 'when', heading: 'TIME' },
              { key: 'from', heading: 'FROM' },
              { key: 'to', heading: 'TO' },
              { key: 'reason', heading: 'REASON' },
            ]}
            rows={history.map((row) => ({
              upi: row.upi_address,
              when: new Date(row.created_at).toLocaleString(),
              from: row.from_status ?? '—',
              to: row.to_status,
              reason: row.reason ?? '—',
            }))}
            empty={<EmptyState message="No history" />}
          />
        </div>
      ) : null}
      {closeTarget ? (
        <ConfirmDialog
          title={`Close ${closeTarget.label}?`}
          subtitle="This is a soft close. The row stays in the list as CLOSED and cannot be reopened."
          confirmLabel="Close"
          loading={submitting === closeTarget.id}
          onCancel={() => setCloseTarget(null)}
          onConfirm={() => void handleClose()}
        />
      ) : null}
    </AppShell>
  )
}
