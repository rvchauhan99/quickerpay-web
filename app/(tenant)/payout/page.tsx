'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, MerchantListItem, Pagination, PayoutListItem } from '@quickerpay/shared-types'
import { PAYOUT_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, Check, X, CheckCircle, XCircle } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { isLabConsole } from '@/lib/lab'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

export default function PayoutPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYOUT')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    status: parseAsString.withDefault('IN_PROCESS'),
    q: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    admin_user_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<PayoutListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'process' | 'fail' | 'reject' | 'cancel' | 'retry' } | null>(null)
  const [successFor, setSuccessFor] = useState<string | null>(null)
  const [utr, setUtr] = useState('')
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [creating, setCreating] = useState(false)
  const [merchantId, setMerchantId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('')
  const [sourceBankId, setSourceBankId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    query.set('status', filters.status || 'IN_PROCESS')
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.q) query.set('q', filters.q)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
    try {
      const result = await apiListRequest<PayoutListItem>(`/api/v1/payout?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.q, filters.merchant_id, filters.admin_user_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useEffect(() => {
    if (!accessToken || !allowed || !hasMenu(menus, 'PAYOUT', 'can_create')) return
    if (user?.role === 'SUPER_ADMIN') {
      void apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken })
        .then((result) => setMerchants(result.items.filter((row) => row.status === 'ACTIVE')))
        .catch((caught) => {
          setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load merchants')
        })
    }
    void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken })
      .then((result) => setBanks(result.items.filter((row) => row.status === 'ACTIVE')))
      .catch((caught) => {
        setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load banks')
      })
  }, [accessToken, allowed, menus, user?.role])

  const { isSuperAdmin, admins, merchants: directoryMerchants } = useSuperAdminDirectory(accessToken, user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const canPickMerchant = user.role === 'SUPER_ADMIN'

  const handleAction = async () => {
    if (!confirm || !accessToken || submitting) return
    setSubmitting(confirm.id)
    try {
      await apiRequest(`/api/v1/payout/${confirm.id}/${confirm.action}`, {
        method: 'POST',
        token: accessToken,
        body: confirm.action === 'fail' || confirm.action === 'reject' ? { reason: 'Rejected' } : undefined,
      })
      setConfirm(null)
      toast.success(`Pay-out ${confirm.action}d`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update pay-out')
      setConfirm(null)
    } finally {
      setSubmitting(null)
    }
  }

  const handleSuccess = async () => {
    if (!successFor || !accessToken || submitting) return
    setSubmitting(successFor)
    try {
      await apiRequest(`/api/v1/payout/${successFor}/success`, {
        method: 'POST',
        token: accessToken,
        body: { utr },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      setSuccessFor(null)
      setUtr('')
      toast.success('Pay-out marked as complete')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not mark success')
    } finally {
      setSubmitting(null)
    }
  }

  const handleCreate = async () => {
    if (!accessToken || amountMinor <= 0 || !beneficiaryName || !beneficiaryAccount || !sourceBankId || submitting) return
    if (canPickMerchant && !merchantId) return
    setSubmitting('create')
    try {
      await apiRequest('/api/v1/payout', {
        method: 'POST',
        token: accessToken,
        body: {
          ...(canPickMerchant ? { merchant_id: merchantId } : {}),
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
      setSubmitting(null)
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
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: '', q: '', merchant_id: '', admin_user_id: '', page: 1 })} onReload={() => void load()}>
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
              query.set('status', filters.status || 'IN_PROCESS')
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
      {creating && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
        <div className="mb-4">
          <FormShell title="Create Pay-Out" submitLabel="Create" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Request">
              <FormGrid>
                {canPickMerchant ? (
                <FormField label="Merchant" required>
                  <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Merchant">
                    <option value="">Select merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.merchant_code} — {merchant.display_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                ) : null}
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
              <span className="flex flex-wrap items-center gap-1">
                <IconButton href={`/payout/${row.id}`} icon={<Eye size={15} strokeWidth={1.75} />} tooltip="View details" />
                {hasMenu(menus, 'PAYOUT', 'can_approve') && row.status === 'INITIATE' ? (
                  <>
                    <IconButton variant="primary" icon={<Check size={15} strokeWidth={1.75} />} tooltip="Approve" onClick={() => setConfirm({ id: row.id, action: 'approve' })} />
                    <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Reject" onClick={() => setConfirm({ id: row.id, action: 'reject' })} />
                  </>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && row.status === 'IN_PROCESS' ? (
                  <>
                    <IconButton variant="primary" icon={<CheckCircle size={15} strokeWidth={1.75} />} tooltip="Complete" onClick={() => setSuccessFor(row.id)} />
                    <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Fail" onClick={() => setConfirm({ id: row.id, action: 'fail' })} />
                  </>
                ) : null}
                {hasMenu(menus, 'PAYOUT', 'can_edit') && row.status === 'INITIATE' ? (
                  <IconButton variant="secondary" icon={<XCircle size={15} strokeWidth={1.75} />} tooltip="Cancel" onClick={() => setConfirm({ id: row.id, action: 'cancel' })} />
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
      {confirm ? <ConfirmDialog title={`${confirm.action} this pay-out?`} confirmLabel={confirm.action} loading={submitting === confirm.id} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} /> : null}
      {successFor ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30" role="dialog" aria-label="Mark success">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-3">
            <label className="text-xs" htmlFor="payout-utr">
              UTR
              <input id="payout-utr" className="mt-1 h-8 w-full rounded border border-zinc-300 px-2" value={utr} onChange={(event) => setUtr(event.target.value)} />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => setSuccessFor(null)}>Cancel</button>
              <button type="button" disabled={submitting === successFor} className="h-7 rounded bg-zinc-900 px-2 text-xs text-white disabled:opacity-60" onClick={() => void handleSuccess()}>
                {submitting === successFor ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
