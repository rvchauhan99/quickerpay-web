'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { MerchantListItem, Pagination, PayinListItem, UpiAccountListItem, UserListItem } from '@quickerpay/shared-types'
import { PAYIN_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, Link2, Check, X, XCircle, Undo2, Hash } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { canSeeMerchants, canSeeOwnPanelUsernames } from '@/lib/merchant-visibility'
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
    banker_user_id: parseAsString.withDefault(''),
    inject: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const isInjectMode = filters.inject === '1'
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
  const [injectionOwners, setInjectionOwners] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [creating, setCreating] = useState(false)
  const [merchantId, setMerchantId] = useState('')
  const [bankerUserId, setBankerUserId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [createUpi, setCreateUpi] = useState('')
  const [createOperator, setCreateOperator] = useState('')
  const [createUtr, setCreateUtr] = useState('')
  const [acceptInjection, setAcceptInjection] = useState<PayinListItem | null>(null)
  const [acceptUpiId, setAcceptUpiId] = useState('')
  const [submitUtrFor, setSubmitUtrFor] = useState<PayinListItem | null>(null)
  const [submitUtrValue, setSubmitUtrValue] = useState('')

  const canCreateInjection =
    isInjectMode &&
    hasMenu(menus, 'PAYIN', 'can_create') &&
    (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN')

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
    if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
    if (filters.inject === '1') query.set('injection', 'true')
    try {
      const result = await apiListRequest<PayinListItem>(`/api/v1/payin?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.status, filters.date_from, filters.date_to, filters.q, filters.merchant_id, filters.banker_user_id, filters.inject])

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
      banker_user_id: filters.banker_user_id || undefined,
      ...(filters.inject === '1' ? { injection: 'true' } : {}),
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
    if (!canSeeMerchants(user?.role)) return
    void apiListRequest<MerchantListItem>('/api/v1/merchants?status=ACTIVE&page_size=100', {
      token: accessToken,
    })
      .then((result) => setMerchants(result.items))
      .catch((caught) => {
        setError(
          caught instanceof ApiClientError
            ? caught.displayMessage()
            : `Could not load ${merchantLabel({ plural: true })}`,
        )
      })
  }, [accessToken, allowed, menus, user?.role])

  useEffect(() => {
    if (!accessToken || !allowed || !canCreateInjection) return
    void apiListRequest<UserListItem>('/api/v1/users?role=BANKER&status=ACTIVE&page_size=100', {
      token: accessToken,
    })
      .then((result) => setInjectionOwners(result.items))
      .catch(() => setInjectionOwners([]))
  }, [accessToken, allowed, canCreateInjection])

  const { isSuperAdmin, canFilterMerchants, admins, merchants: directoryMerchants } = useSuperAdminDirectory(accessToken, user?.role)
  const showPanelUsername = canSeeOwnPanelUsernames(user?.role)

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const createMerchants = merchants.length > 0 ? merchants : directoryMerchants.filter((row) => row.status === 'ACTIVE')

  const assigneesForUpi = (upiId: string) => {
    const upi = upis.find((row) => row.id === upiId)
    if (!upi) return []
    const owner = {
      id: upi.owner_user_id,
      label: `${upi.owner_username} (${bankerLabel()})`,
    }
    const operators = users
      .filter((row) => row.role === 'OPERATOR' && row.supervisor_banker_id === upi.owner_user_id && row.status === 'ACTIVE')
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

  const handleAcceptClick = (row: PayinListItem) => {
    if (row.is_injection && !row.assigned_upi_id) {
      setAcceptInjection(row)
      setAcceptUpiId('')
      return
    }
    setConfirm({ id: row.id, action: 'accept' })
  }

  const handleInjectionAccept = async () => {
    if (!acceptInjection || !accessToken || !acceptUpiId || submitting) return
    setSubmitting(acceptInjection.id)
    try {
      await apiRequest(`/api/v1/payin/${acceptInjection.id}/accept`, {
        method: 'POST',
        token: accessToken,
        body: { upi_account_id: acceptUpiId },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      setAcceptInjection(null)
      setAcceptUpiId('')
      toast.success('Pay-in accepted')
      await load()
    } catch (caught) {
      toast.error(formatApiError(caught, 'Could not accept pay-in'))
    } finally {
      setSubmitting(null)
    }
  }

  const handleSubmitUtr = async () => {
    const utr = submitUtrValue.trim()
    if (!submitUtrFor || !accessToken || !/^\d{6,32}$/.test(utr) || submitting) return
    setSubmitting(submitUtrFor.id)
    try {
      await apiRequest(`/api/v1/payin/${submitUtrFor.id}/submit-utr`, {
        method: 'POST',
        token: accessToken,
        body: { utr },
      })
      setSubmitUtrFor(null)
      setSubmitUtrValue('')
      toast.success('UTR submitted')
      await setFilters({ status: 'IN_PROCESS', page: 1 })
      await load()
    } catch (caught) {
      toast.error(formatApiError(caught, 'Could not submit UTR'))
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

  const handleCreateInjection = async () => {
    if (!accessToken || amountMinor <= 0 || !merchantId || !bankerUserId || submitting) return
    setSubmitting('create-injection')
    try {
      const created = await apiRequest<PayinListItem>('/api/v1/payin/injections', {
        method: 'POST',
        token: accessToken,
        body: {
          merchant_id: merchantId,
          banker_user_id: bankerUserId,
          amount_minor: amountMinor,
        },
      })
      setMerchantId('')
      setBankerUserId('')
      setAmountMinor(0)
      const ref = created.reference
      toast.success(`Pay-in created — ${ref}`, {
        action: {
          label: 'Copy',
          onClick: () => {
            void navigator.clipboard.writeText(ref)
          },
        },
      })
      await setFilters({ status: 'INITIATE', page: 1 })
      await load()
    } catch (caught) {
      toast.error(formatApiError(caught, 'Could not create injection'))
    } finally {
      setSubmitting(null)
    }
  }

  const handleCreate = async () => {
    const utr = createUtr.trim()
    if (!accessToken || amountMinor <= 0 || !createUpi || !/^\d{6,32}$/.test(utr) || submitting) return
    if (!merchantId) {
      toast.error(`Select an ${merchantLabel()}`)
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

  const payinTypeLabel = (row: PayinListItem) => {
    if (row.is_injection) return 'INJECTION'
    if (row.source === 'API') return row.auto_accepted ? 'API BOT' : 'API'
    if (row.auto_accepted) return 'PAYIN BOT'
    return 'PAYIN'
  }

  const injectionAcceptUpis = acceptInjection
    ? upis.filter(
        (row) =>
          row.status === 'ACTIVE' &&
          (!acceptInjection.banker_user_id || row.owner_user_id === acceptInjection.banker_user_id),
      )
    : []

  return (
    <AppShell title={isInjectMode ? 'Payin Injection' : 'Pending Deposit'} role={user.role} menus={menus}>
      <PageHeader
        title={isInjectMode ? 'Payin Injection' : 'Pending Deposit'}
        action={
          !isInjectMode && hasMenu(menus, 'PAYIN', 'can_create') && isLabConsole() && user.role !== 'SUPER_ADMIN' ? (
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
      <FilterBar
        onApply={() => void load()}
        onClear={() =>
          void setFilters({
            date_from: '',
            date_to: '',
            status: isInjectMode ? '' : 'IN_PROCESS',
            q: '',
            merchant_id: '',
            banker_user_id: '',
            page: 1,
          })
        }
        onReload={() => void load()}
      >
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
        {canFilterMerchants ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={directoryMerchants.length > 0 ? directoryMerchants : merchants}
            adminId={filters.banker_user_id}
            merchantId={filters.merchant_id}
            showAdmin={isSuperAdmin}
            onAdminChange={isSuperAdmin ? (value) => void setFilters({ banker_user_id: value, page: 1 }) : undefined}
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
              if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
              if (isInjectMode) query.set('injection', 'true')
              void downloadExport(`/api/v1/payin/export?${query}`, 'payins.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>

      {canCreateInjection ? (
        <div className="mb-qp-gap">
          <FormShell
            title="Payin Injection"
            submitLabel="Create Payin"
            onCancel={() => {
              setMerchantId('')
              setBankerUserId('')
              setAmountMinor(0)
            }}
            onSubmit={() => void handleCreateInjection()}
          >
            <FormSection title="Create">
              <FormGrid>
                <FormField label="Exchange" required>
                  <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label="Select Exchange">
                    <option value="">Select Exchange</option>
                    {createMerchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.merchant_code} — {merchant.display_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={bankerLabel()} required>
                  <Select value={bankerUserId} onChange={(event) => setBankerUserId(event.target.value)} aria-label={`Select ${bankerLabel()}`}>
                    <option value="">Select {bankerLabel()}</option>
                    {injectionOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.username} — {owner.display_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Amount" required hint="Whole rupees.">
                  <MoneyInput id="injection-amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} wholeRupees />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {creating && !isInjectMode && isLabConsole() && canFilterMerchants && user.role !== 'SUPER_ADMIN' ? (
        <div className="mb-qp-gap">
          <FormShell title="Create Pay-In" submitLabel="Create" onCancel={() => setCreating(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Request">
              <FormGrid>
                <FormField label={merchantLabel()} required>
                  <Select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} aria-label={merchantLabel()}>
                    <option value="">{`Select ${merchantLabel()}`}</option>
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
                <FormField label="Assign operator" required hint={`Defaults to the UPI ${bankerLabel()}. Operators of that ${bankerLabel()} can be selected.`}>
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
        <div className="mb-qp-gap">
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
            ...(showPanelUsername ? [{ key: 'username', heading: 'USERNAME' }] : []),
            ...(canFilterMerchants ? [{ key: 'merchant', heading: merchantLabel().toUpperCase() }] : []),
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
            ...(showPanelUsername
              ? {
                  username: row.customer_ref?.trim() || '—',
                }
              : {}),
            ...(canFilterMerchants
              ? {
                  merchant: row.merchant_display_name?.trim() || '—',
                }
              : {}),
            inprog: row.in_progress_at ? new Date(row.in_progress_at).toLocaleString() : '—',
            actionTime: row.action_at ? new Date(row.action_at).toLocaleString() : '—',
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            type: payinTypeLabel(row),
            status: <StatusBadge status={row.status} />,
            actions: (
              <span className="flex flex-wrap items-center gap-1">
                <IconButton href={`/payin/${row.id}`} icon={<Eye size={15} strokeWidth={1.75} />} tooltip="View details" />
                {user.role === 'MERCHANT' && row.is_injection && row.status === 'INITIATE' ? (
                  <IconButton
                    variant="primary"
                    icon={<Hash size={15} strokeWidth={1.75} />}
                    tooltip="Submit UTR"
                    onClick={() => {
                      setSubmitUtrFor(row)
                      setSubmitUtrValue('')
                    }}
                  />
                ) : null}
                {!row.is_injection && hasMenu(menus, 'PAYIN', 'can_edit') && (row.status === 'INITIATE' || row.status === 'IN_PROCESS') ? (
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
                    <IconButton variant="primary" icon={<Check size={15} strokeWidth={1.75} />} tooltip="Accept" onClick={() => handleAcceptClick(row)} />
                    <IconButton variant="danger" icon={<X size={15} strokeWidth={1.75} />} tooltip="Reject" onClick={() => setConfirm({ id: row.id, action: 'reject' })} />
                  </>
                ) : null}
                {hasMenu(menus, 'PAYIN', 'can_edit') && row.status === 'INITIATE' && user.role !== 'MERCHANT' ? (
                  <IconButton variant="secondary" icon={<XCircle size={15} strokeWidth={1.75} />} tooltip="Cancel" onClick={() => setConfirm({ id: row.id, action: 'cancel' })} />
                ) : null}
                {user.role === 'SUPER_ADMIN' && row.status === 'COMPLETED' ? (
                  <IconButton variant="danger" icon={<Undo2 size={15} strokeWidth={1.75} />} tooltip="Refund" onClick={() => setConfirm({ id: row.id, action: 'refund' })} />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message={isInjectMode ? 'No Pay-In Injection requests found' : 'No Pay-In requests found'} />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {confirm ? (
        <ConfirmDialog title={`${confirm.action} this pay-in?`} confirmLabel={confirm.action} loading={submitting === confirm.id} onCancel={() => setConfirm(null)} onConfirm={() => void handleAction()} />
      ) : null}
      {acceptInjection ? (
        <Modal
          title="Accept injection"
          footer={
            <>
              <button
                type="button"
                className="h-8 rounded border border-zinc-300 px-3 text-xs"
                onClick={() => { setAcceptInjection(null); setAcceptUpiId('') }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!acceptUpiId || submitting === acceptInjection.id}
                className="h-8 rounded bg-zinc-900 px-3 text-xs text-white disabled:opacity-60"
                onClick={() => void handleInjectionAccept()}
              >
                {submitting === acceptInjection.id ? 'Accepting…' : 'Accept'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Ref <span className="font-medium text-zinc-900">{acceptInjection.reference}</span>
              {acceptInjection.utr ? (
                <>
                  {' '}· UTR <span className="font-medium text-zinc-900">{acceptInjection.utr}</span>
                </>
              ) : null}
              {' '}· <MoneyDisplay amountMinor={acceptInjection.amount_minor} />
            </p>
            <FormField label="UPI" required hint={`Select an ACTIVE UPI owned by the injection ${bankerLabel()}.`}>
              <Select value={acceptUpiId} onChange={(event) => setAcceptUpiId(event.target.value)} aria-label="Select UPI">
                <option value="">Select UPI</option>
                {injectionAcceptUpis.map((upi) => (
                  <option key={upi.id} value={upi.id}>{upi.upi_address}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </Modal>
      ) : null}
      {submitUtrFor ? (
        <Modal
          title="Submit UTR"
          footer={
            <>
              <button
                type="button"
                className="h-8 rounded border border-zinc-300 px-3 text-xs"
                onClick={() => { setSubmitUtrFor(null); setSubmitUtrValue('') }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!/^\d{6,32}$/.test(submitUtrValue.trim()) || submitting === submitUtrFor.id}
                className="h-8 rounded bg-zinc-900 px-3 text-xs text-white disabled:opacity-60"
                onClick={() => void handleSubmitUtr()}
              >
                {submitting === submitUtrFor.id ? 'Submitting…' : 'Submit'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Ref <span className="font-medium text-zinc-900">{submitUtrFor.reference}</span>
              {' '}· <MoneyDisplay amountMinor={submitUtrFor.amount_minor} />
            </p>
            <FormField label="UTR" required hint="6 to 32 digits from the payment receipt.">
              <Input
                value={submitUtrValue}
                onChange={(event) => setSubmitUtrValue(event.target.value.replace(/\D/g, '').slice(0, 32))}
                inputMode="numeric"
                autoComplete="off"
                aria-label="UTR"
                placeholder="Enter UTR"
              />
            </FormField>
          </div>
        </Modal>
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
