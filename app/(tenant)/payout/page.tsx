'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  MerchantListItem,
  Pagination,
  PayoutAttachmentView,
  PayoutListItem,
} from '@quickerpay/shared-types'
import { PAYOUT_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, X, CheckCircle, Paperclip } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { PayoutActionDialogs } from '@/components/forms/PayoutActionDialogs'
import { PayoutBankDetailsCell } from '@/components/forms/PayoutBankDetailsCell'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { fromMinor } from '@quickerpay/money'
import { hasMenu } from '@/lib/session'
import { isLabConsole } from '@/lib/lab'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'
import { useQueueSync } from '@/lib/live/useQueueSync'

export default function PayoutPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    status: parseAsString.withDefault('INITIATE'),
    q: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    admin_user_id: parseAsString.withDefault(''),
    unassigned: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<PayoutListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectFor, setRejectFor] = useState<PayoutListItem | null>(null)
  const [successFor, setSuccessFor] = useState<PayoutListItem | null>(null)
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [creating, setCreating] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [merchantId, setMerchantId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('')
  const [sourceBankId, setSourceBankId] = useState('')
  const [assignAdminId, setAssignAdminId] = useState('')
  const [assignAmountMinor, setAssignAmountMinor] = useState(0)
  const [assigning, setAssigning] = useState(false)
  const didDefaultSaUnassigned = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    query.set('status', filters.status || 'INITIATE')
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.q) query.set('q', filters.q)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
    if (filters.unassigned === 'true') query.set('unassigned', 'true')
    try {
      const result = await apiListRequest<PayoutListItem>(`/api/v1/payout?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.q, filters.merchant_id, filters.admin_user_id, filters.unassigned])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useEffect(() => {
    if (!ready || !user || user.role !== 'SUPER_ADMIN' || didDefaultSaUnassigned.current) return
    didDefaultSaUnassigned.current = true
    void setFilters({ unassigned: 'true', status: 'INITIATE', page: 1 })
  }, [ready, user, setFilters])

  const { pendingOnPage1 } = useQueueSync({
    entity: 'payout',
    enabled: ready && allowed,
    accessToken,
    statusFilter: filters.status || 'INITIATE',
    page: filters.page,
    pageSize: filters.page_size,
    query: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      q: filters.q || undefined,
      merchant_id: filters.merchant_id || undefined,
      admin_user_id: filters.admin_user_id || undefined,
      unassigned: filters.unassigned === 'true' ? 'true' : undefined,
    },
    rows,
    setRows,
    pagination,
    setPagination,
    unassignedFilter: filters.unassigned === 'true',
  })

  useEffect(() => {
    if (!accessToken || !allowed) return
    if (hasMenu(menus, 'PAYOUT', 'can_create')) {
      void apiListRequest<MerchantListItem>('/api/v1/merchants?status=ACTIVE&page_size=100', {
        token: accessToken,
      })
        .then((result) => setMerchants(result.items))
        .catch((caught) => {
          setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load merchants')
        })
    }
    if (hasMenu(menus, 'PAYOUT', 'can_create') || hasMenu(menus, 'PAYOUT', 'can_edit')) {
      void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken })
        .then((result) => setBanks(result.items.filter((row) => row.status === 'ACTIVE')))
        .catch((caught) => {
          setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load banks')
        })
    }
  }, [accessToken, allowed, menus])

  const { isSuperAdmin, admins, merchants: directoryMerchants } = useSuperAdminDirectory(accessToken, user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const createMerchants = merchants.length > 0 ? merchants : directoryMerchants.filter((row) => row.status === 'ACTIVE')
  const activeAdmins = admins.filter((row) => row.role === 'ADMIN' && row.status === 'ACTIVE')

  const handleBulkAssign = async () => {
    if (!accessToken || !assignAdminId || assignAmountMinor <= 0 || assigning) return
    setAssigning(true)
    try {
      const result = await apiRequest<{
        assigned_ids: string[]
        assigned_amount_minor: number
        remaining_amount_minor: number
      }>('/api/v1/payout/bulk-assign', {
        method: 'POST',
        token: accessToken,
        body: { admin_user_id: assignAdminId, amount_minor: assignAmountMinor },
      })
      toast.success(
        result.assigned_ids.length === 0
          ? 'No unassigned pay-outs fit that amount'
          : `Assigned ${result.assigned_ids.length} pay-out(s) (${fromMinor(BigInt(result.assigned_amount_minor))})`,
      )
      setAssignAmountMinor(0)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not bulk-assign')
    } finally {
      setAssigning(false)
    }
  }

  const handleViewAttachment = async (row: PayoutListItem) => {
    if (!accessToken || !row.has_attachment) return
    try {
      const view = await apiRequest<PayoutAttachmentView>(`/api/v1/payout/${row.id}/attachment`, {
        token: accessToken,
      })
      window.open(view.url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not open attachment')
    }
  }

  const handleCreate = async () => {
    if (!accessToken || amountMinor <= 0 || !beneficiaryName || !beneficiaryAccount || !sourceBankId || createSubmitting) return
    if (!merchantId) {
      toast.error('Select a merchant')
      return
    }
    setCreateSubmitting(true)
    try {
      await apiRequest('/api/v1/payout', {
        method: 'POST',
        token: accessToken,
        body: {
          merchant_id: merchantId,
          amount_minor: amountMinor,
          beneficiary_name: beneficiaryName,
          beneficiary_account: beneficiaryAccount,
          source_bank_account_id: sourceBankId,
        },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      setCreating(false)
      setMerchantId('')
      setAmountMinor(0)
      setBeneficiaryName('')
      setBeneficiaryAccount('')
      setSourceBankId('')
      toast.success('Pay-out created')
      await setFilters({ status: 'INITIATE', page: 1 })
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not create pay-out')
    } finally {
      setCreateSubmitting(false)
    }
  }

  return (
    <AppShell title="Pay-Out Requests" role={user.role} menus={menus}>
      <PageHeader
        title="Pay-Out Requests"
        action={
          hasMenu(menus, 'PAYOUT', 'can_create') && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
            <PrimaryButton onClick={() => setCreating(true)}>Create</PrimaryButton>
          ) : null
        }
      />
      {pendingOnPage1 > 0 && filters.page > 1 ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pendingOnPage1} new pay-out{pendingOnPage1 === 1 ? '' : 's'} on page 1.{' '}
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
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: 'INITIATE', q: '', merchant_id: '', admin_user_id: '', unassigned: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {PAYOUT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input placeholder="Gateway Ref. No / UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        {isSuperAdmin ? (
          <FormField label="Queue">
            <Select
              value={filters.unassigned}
              onChange={(event) =>
                void setFilters({
                  unassigned: event.target.value,
                  status: event.target.value === 'true' ? 'INITIATE' : filters.status || 'INITIATE',
                  page: 1,
                })
              }
              aria-label="Assignment queue"
            >
              <option value="">All</option>
              <option value="true">Unassigned (Supago)</option>
            </Select>
          </FormField>
        ) : null}
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={directoryMerchants}
            adminId={filters.admin_user_id}
            merchantId={filters.merchant_id}
            onAdminChange={(value) => void setFilters({ admin_user_id: value, page: 1 })}
            onMerchantChange={(value) => void setFilters({ merchant_id: value, page: 1 })}
          />
        ) : null}
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'PAYOUT', 'can_export')}
            onExport={() => {
              const query = new URLSearchParams()
              query.set('status', filters.status || 'INITIATE')
              if (filters.date_from) query.set('date_from', filters.date_from)
              if (filters.date_to) query.set('date_to', filters.date_to)
              if (filters.q) query.set('q', filters.q)
              if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
              if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
              void downloadExport(`/api/v1/payout/export?${query}`, 'payouts.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>
      {isSuperAdmin && hasMenu(menus, 'PAYOUT', 'can_approve') ? (
        <div className="mb-4 rounded border border-zinc-200 bg-white p-3">
          <FormShell
            title="Bulk assign unassigned pay-outs"
            submitLabel={assigning ? 'Assigning…' : 'Assign by amount'}
            onSubmit={() => void handleBulkAssign()}
          >
            <FormSection title="Assign" description="FIFO from the unassigned INITIATE queue until the amount cap is filled.">
              <FormGrid>
                <FormField label="Admin" required>
                  <Select value={assignAdminId} onChange={(event) => setAssignAdminId(event.target.value)} aria-label="Assign Admin">
                    <option value="">Select Admin</option>
                    {activeAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.username}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Amount cap" required hint="Assign oldest unassigned rows whose sum stays within this amount">
                  <MoneyInput id="bulk-assign-amount" valueMinor={assignAmountMinor} onChangeMinor={setAssignAmountMinor} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}
      {creating && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
        <div className="mb-4">
          <FormShell title="Create Pay-Out" submitLabel="Create" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Request">
              <FormGrid>
                <FormField label="Merchant" required>
                  <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Merchant">
                    <option value="">Select merchant</option>
                    {createMerchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.merchant_code} — {merchant.display_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Amount" required>
                  <MoneyInput id="payout-amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
                </FormField>
                <FormField label="Source bank" required>
                  <Select value={sourceBankId} onChange={(event) => setSourceBankId(event.target.value)} aria-label="Source bank">
                    <option value="">Select bank</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.label} {bank.account_number_masked ?? ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Beneficiary name" required>
                  <Input value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} />
                </FormField>
                <FormField label="Beneficiary account" required>
                  <Input value={beneficiaryAccount} onChange={(event) => setBeneficiaryAccount(event.target.value)} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}
      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'created', heading: 'CREATED' },
            { key: 'username', heading: 'USERNAME' },
            { key: 'bank', heading: 'BANK DETAILS' },
            { key: 'amount', heading: 'AMOUNT' },
            { key: 'utr', heading: 'UTR' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          rows={rows.map((row) => ({
            created: new Date(row.created_at).toLocaleString(),
            username: row.supago_username ?? '—',
            bank: <PayoutBankDetailsCell row={row} />,
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            utr: row.utr ?? '—',
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex flex-wrap items-center gap-1">
                <IconButton href={`/payout/${row.id}`} icon={<Eye size={15} strokeWidth={1.75} />} tooltip="View details" />
                {row.has_attachment ? (
                  <IconButton
                    variant="secondary"
                    icon={<Paperclip size={15} strokeWidth={1.75} />}
                    tooltip="View attachment"
                    onClick={() => void handleViewAttachment(row)}
                  />
                ) : null}
                {row.status === 'INITIATE' ? (
                  <>
                    {hasMenu(menus, 'PAYOUT', 'can_edit') ? (
                      <IconButton
                        variant="primary"
                        icon={<CheckCircle size={15} strokeWidth={1.75} />}
                        tooltip="Accept"
                        onClick={() => setSuccessFor(row)}
                      />
                    ) : null}
                    {hasMenu(menus, 'PAYOUT', 'can_edit') ? (
                      <IconButton
                        variant="danger"
                        icon={<X size={15} strokeWidth={1.75} />}
                        tooltip="Reject"
                        onClick={() => setRejectFor(row)}
                      />
                    ) : null}
                  </>
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
      {accessToken ? (
        <PayoutActionDialogs
          acceptFor={successFor}
          rejectFor={rejectFor}
          banks={banks}
          accessToken={accessToken}
          onCloseAccept={() => setSuccessFor(null)}
          onCloseReject={() => setRejectFor(null)}
          onAccepted={load}
          onRejected={load}
        />
      ) : null}
    </AppShell>
  )
}
