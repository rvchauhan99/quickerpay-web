'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MerchantListItem, Pagination, PayinListItem, UpiAccountListItem, UserListItem } from '@quickerpay/shared-types'
import { PAYIN_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, Link2, Check, X, XCircle, Undo2 } from 'lucide-react'
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
import { useQueueSync } from '@/lib/live/useQueueSync'

function formatApiError(caught: unknown, fallback: string): string {
  if (!(caught instanceof ApiClientError)) return fallback
  const base = caught.displayMessage()
  return caught.requestId ? `${base} (${caught.requestId})` : base
}

export default function PayinPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('PAYIN')
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
  const [rows, setRows] = useState<PayinListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'accept' | 'reject' | 'cancel' | 'refund' } | null>(null)
  const [assignFor, setAssignFor] = useState<string | null>(null)
  const [assignUpi, setAssignUpi] = useState('')
  const [assignOperator, setAssignOperator] = useState('')
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [creating, setCreating] = useState(false)
  const [merchantId, setMerchantId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [createUpi, setCreateUpi] = useState('')
  const [createOperator, setCreateOperator] = useState('')
  const [createUtr, setCreateUtr] = useState('')

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.status) query.set('status', filters.status)
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.q) query.set('q', filters.q)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
    try {
      const result = await apiListRequest<PayinListItem>(`/api/v1/payin?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.q, filters.merchant_id, filters.admin_user_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  const { pendingOnPage1 } = useQueueSync({
    entity: 'payin',
    enabled: ready && allowed,
    accessToken,
    statusFilter: filters.status,
    page: filters.page,
    pageSize: filters.page_size,
    query: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      q: filters.q || undefined,
      merchant_id: filters.merchant_id || undefined,
      admin_user_id: filters.admin_user_id || undefined,
    },
    rows,
    setRows,
    pagination,
    setPagination,
  })

  useEffect(() => {
    if (!accessToken || !allowed) return
    void apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken })
      .then((result) => setUpis(result.items))
      .catch((caught) => {
        setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load UPI accounts')
      })
    void apiListRequest<UserListItem>('/api/v1/users?page_size=100', { token: accessToken })
      .then((result) => setUsers(result.items))
      .catch(() => {
        setUsers([])
      })
  }, [accessToken, allowed])

  useEffect(() => {
    if (!accessToken || !allowed || !hasMenu(menus, 'PAYIN', 'can_create')) return
    void apiListRequest<MerchantListItem>('/api/v1/merchants?status=ACTIVE&page_size=100', {
      token: accessToken,
    })
      .then((result) => setMerchants(result.items))
      .catch((caught) => {
        setError(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load merchants')
      })
  }, [accessToken, allowed, menus])

  const { isSuperAdmin, admins, merchants: directoryMerchants } = useSuperAdminDirectory(accessToken, user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const createMerchants = merchants.length > 0 ? merchants : directoryMerchants.filter((row) => row.status === 'ACTIVE')

  const assigneesForUpi = (upiId: string) => {
    const upi = upis.find((row) => row.id === upiId)
    if (!upi) return []
    const owner = {
      id: upi.owner_user_id,
      label: `${upi.owner_username} (Admin)`,
    }
    const operators = users
      .filter((row) => row.role === 'OPERATOR' && row.supervisor_admin_id === upi.owner_user_id && row.status === 'ACTIVE')
      .map((row) => ({ id: row.id, label: `${row.username} (Operator)` }))
    return [owner, ...operators.filter((row) => row.id !== owner.id)]
  }

  const handleUpiChange = (upiId: string, kind: 'create' | 'assign') => {
    const ownerId = upis.find((row) => row.id === upiId)?.owner_user_id ?? ''
    if (kind === 'create') {
      setCreateUpi(upiId)
      setCreateOperator(ownerId)
      return
    }
    setAssignUpi(upiId)
    setAssignOperator(ownerId)
  }

  const handleAction = async () => {
    if (!confirm || !accessToken || submitting) return
    setSubmitting(confirm.id)
    try {
      await apiRequest(`/api/v1/payin/${confirm.id}/${confirm.action}`, {
        method: 'POST',
        token: accessToken,
        body: confirm.action === 'reject' ? { reason: 'Rejected' } : undefined,
        headers: confirm.action === 'accept' || confirm.action === 'refund' ? { 'Idempotency-Key': crypto.randomUUID() } : undefined,
      })
      setConfirm(null)
      toast.success(`Pay-in ${confirm.action}ed`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update pay-in')
      setConfirm(null)
    } finally {
      setSubmitting(null)
    }
  }

  const handleAssign = async () => {
    if (!assignFor || !accessToken || !assignUpi || submitting) return
    setSubmitting(assignFor)
    try {
      await apiRequest(`/api/v1/payin/${assignFor}/assign`, {
        method: 'POST',
        token: accessToken,
        body: {
          upi_account_id: assignUpi,
          ...(assignOperator ? { operator_user_id: assignOperator } : {}),
        },
      })
      setAssignFor(null)
      setAssignUpi('')
      setAssignOperator('')
      toast.success('UPI assigned')
      await setFilters({ status: 'IN_PROCESS', page: 1 })
      await load()
    } catch (caught) {
      toast.error(formatApiError(caught, 'Could not assign UPI'))
    } finally {
      setSubmitting(null)
    }
  }

  const handleCreate = async () => {
    const utr = createUtr.trim()
    if (!accessToken || amountMinor <= 0 || !createUpi || !/^\d{6,32}$/.test(utr) || submitting) return
    if (!merchantId) {
      toast.error('Select a merchant')
      return
    }
    setSubmitting('create')
    try {
      const created = await apiRequest<PayinListItem>('/api/v1/payin', {
        method: 'POST',
        token: accessToken,
        body: {
          amount_minor: amountMinor,
          merchant_id: merchantId,
        },
      })
      await apiRequest(`/api/v1/payin/${created.id}/assign`, {
        method: 'POST',
        token: accessToken,
        body: {
          upi_account_id: createUpi,
          utr,
          ...(createOperator ? { operator_user_id: createOperator } : {}),
        },
      })
      setCreating(false)
      setMerchantId('')
      setAmountMinor(0)
      setCreateUpi('')
      setCreateOperator('')
      setCreateUtr('')
      toast.success('Pay-in created')
      await setFilters({ status: 'IN_PROCESS', page: 1 })
      await load()
    } catch (caught) {
      toast.error(formatApiError(caught, 'Could not create pay-in'))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <AppShell title="Pay-In Requests" role={user.role} menus={menus}>
      <PageHeader
        title="Pay-In Requests"
        action={
          hasMenu(menus, 'PAYIN', 'can_create') && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
            <PrimaryButton onClick={() => setCreating(true)}>
              Create
            </PrimaryButton>
          ) : null
        }
      />
      {pendingOnPage1 > 0 && filters.page > 1 ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pendingOnPage1} new pay-in{pendingOnPage1 === 1 ? '' : 's'} on page 1.{' '}
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
      <FilterBar onApply={() => void load()} onClear={() => void setFilters({ date_from: '', date_to: '', status: 'IN_PROCESS', q: '', merchant_id: '', admin_user_id: '', page: 1 })} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="Status">
          <Select value={filters.status} onChange={(event) => void setFilters({ status: event.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {PAYIN_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Search">
          <Input placeholder="Search UTR / ID" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
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
            canExport={hasMenu(menus, 'PAYIN', 'can_export')}
            onExport={() => {
              const query = new URLSearchParams()
              if (filters.status) query.set('status', filters.status)
              if (filters.date_from) query.set('date_from', filters.date_from)
              if (filters.date_to) query.set('date_to', filters.date_to)
              if (filters.q) query.set('q', filters.q)
              if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
              if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
              void downloadExport(`/api/v1/payin/export?${query}`, 'payins.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>

      {creating && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
        <div className="mb-4">
          <FormShell title="Create Pay-In" submitLabel="Create" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
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
                <FormField label="Amount" required hint="Whole rupees. GPay paise are ignored when matching.">
                  <MoneyInput id="payin-amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} wholeRupees />
                </FormField>
                <FormField label="UTR" required hint="GPay UTR, 6 to 32 digits. Match is UTR + UPI + amount.">
                  <Input
                    value={createUtr}
                    onChange={(event) => setCreateUtr(event.target.value.replace(/\D/g, '').slice(0, 32))}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="UTR"
                    placeholder="Enter UTR"
                  />
                </FormField>
                <FormField label="Assign UPI" required hint="Required. Leaves the row IN_PROCESS after match.">
                  <Select value={createUpi} onChange={(event) => handleUpiChange(event.target.value, 'create')} aria-label="Assign UPI">
                    <option value="">Select UPI</option>
                    {upis.filter((row) => row.status === 'ACTIVE').map((upi) => (
                      <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Assign operator" required hint="Defaults to the UPI Admin. Operators of that Admin can be selected.">
                  <Select value={createOperator} onChange={(event) => setCreateOperator(event.target.value)} aria-label="Assign operator">
                    <option value="">Select operator</option>
                    {assigneesForUpi(createUpi).map((row) => (
                      <option key={row.id} value={row.id}>{row.label}</option>
                    ))}
                  </Select>
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {assignFor ? (
        <div className="mb-4">
          <FormShell title={`Assign UPI for Pay-In ${assignFor}`} submitLabel="Assign" onCancel={() => setAssignFor(null)} onSubmit={() => void handleAssign()}>
            <FormField label="Target UPI Account" required>
              <Select value={assignUpi} onChange={(event) => handleUpiChange(event.target.value, 'assign')}>
                <option value="" disabled>Select UPI</option>
                {upis.map((upi) => (
                  <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign operator" required>
              <Select value={assignOperator} onChange={(event) => setAssignOperator(event.target.value)} aria-label="Assign operator">
                <option value="">Select operator</option>
                {assigneesForUpi(assignUpi).map((row) => (
                  <option key={row.id} value={row.id}>{row.label}</option>
                ))}
              </Select>
            </FormField>
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
            type: row.auto_accepted ? 'PAYIN BOT' : 'PAYIN',
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex flex-wrap items-center gap-1">
                <IconButton href={`/payin/${row.id}`} icon={<Eye size={15} strokeWidth={1.75} />} tooltip="View details" />
                {hasMenu(menus, 'PAYIN', 'can_edit') && (row.status === 'INITIATE' || row.status === 'IN_PROCESS') ? (
                  <IconButton
                    icon={<Link2 size={15} strokeWidth={1.75} />}
                    tooltip="Assign UPI"
                    onClick={() => {
                      setAssignFor(row.id)
                      handleUpiChange(row.assigned_upi_id ?? '', 'assign')
                      if (row.assigned_operator_id) setAssignOperator(row.assigned_operator_id)
                    }}
                  />
                ) : null}
                {hasMenu(menus, 'PAYIN', 'can_approve') && row.status === 'IN_PROCESS' ? (
                  <>
                    <IconButton variant="primary" icon={<Check size={15} strokeWidth={1.75} />} tooltip="Accept" onClick={() => setConfirm({ id: row.id, action: 'accept' })} />
                    <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Reject" onClick={() => setConfirm({ id: row.id, action: 'reject' })} />
                  </>
                ) : null}
                {hasMenu(menus, 'PAYIN', 'can_edit') && row.status === 'INITIATE' ? (
                  <IconButton variant="secondary" icon={<XCircle size={15} strokeWidth={1.75} />} tooltip="Cancel" onClick={() => setConfirm({ id: row.id, action: 'cancel' })} />
                ) : null}
                {user.role === 'SUPER_ADMIN' && row.status === 'COMPLETED' ? (
                  <IconButton variant="danger" icon={<Undo2 size={15} strokeWidth={1.75} />} tooltip="Refund" onClick={() => setConfirm({ id: row.id, action: 'refund' })} />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No Pay-In requests found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? (
        <ConfirmDialog title={`${confirm.action} this pay-in?`} confirmLabel={confirm.action} loading={submitting === confirm.id} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} />
      ) : null}
      {assignFor ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30" role="dialog" aria-label="Assign UPI">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-3">
            <label className="text-xs" htmlFor="assign-upi">
              UPI
              <select id="assign-upi" className="mt-1 h-8 w-full rounded border border-zinc-300" value={assignUpi} onChange={(event) => handleUpiChange(event.target.value, 'assign')}>
                <option value="">Select</option>
                {upis.filter((row) => row.status === 'ACTIVE').map((upi) => (
                  <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => setAssignFor(null)}>Cancel</button>
              <button type="button" disabled={submitting === assignFor} className="h-7 rounded bg-zinc-900 px-2 text-xs text-white disabled:opacity-60" onClick={() => void handleAssign()}>
                {submitting === assignFor ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
