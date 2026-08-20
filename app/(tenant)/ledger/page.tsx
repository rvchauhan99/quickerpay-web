'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, LedgerAdjustment, LedgerStatement, UserListItem } from '@quickerpay/shared-types'
import { LEDGER_DIRECTIONS, LEDGER_EVENT_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, EmptyState, ExportButton, FilterBar, TableSkeleton } from '@/components/ui/FilterBar'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { FormShell } from '@/components/forms/FormShell'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { toast } from 'sonner'
import { apiListRequest, apiRequest, ApiClientError, formError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function LedgerPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('LEDGER')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(todayIso()),
    date_to: parseAsString.withDefault(todayIso()),
    owner_user_id: parseAsString.withDefault(''),
    bank_account_id: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
    event_type: parseAsString.withDefault(''),
    direction: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(100),
  })
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [statement, setStatement] = useState<LedgerStatement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [amountMinor, setAmountMinor] = useState(0)
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<LedgerAdjustment | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    if (isSuperAdmin && !filters.owner_user_id && !filters.bank_account_id) {
      setStatement(null)
      setError('Pick an Admin or a bank account')
      return
    }
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
    if (filters.q) query.set('q', filters.q)
    if (filters.event_type) query.set('event_type', filters.event_type)
    if (filters.direction) query.set('direction', filters.direction)
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    try {
      setStatement(await apiRequest<LedgerStatement>(`/api/v1/ledger?${query}`))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load ledger')
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, filters.date_from, filters.date_to, filters.owner_user_id, filters.bank_account_id, filters.q, filters.event_type, filters.direction, filters.page, filters.page_size])

  useEffect(() => {
    if (!ready || !allowed) return
    if (isSuperAdmin) {
      void apiListRequest<UserListItem>('/api/v1/users?role=ADMIN&page_size=100').then((result) =>
        setAdmins(result.items),
      )
      void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100').then((result) =>
        setBanks(result.items),
      )
    }
    if (!isSuperAdmin || filters.owner_user_id || filters.bank_account_id) {
      void load()
    }
  }, [ready, allowed, isSuperAdmin, load, filters.owner_user_id, filters.bank_account_id])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const title = statement
    ? `Ledger - ${statement.owner_display_name ?? user.display_name} - (${user.username})`
    : 'Ledger'

  const handleCreate = async () => {
    if (!accessToken || !filters.owner_user_id || submitting) return
    setSubmitting(true)
    try {
      const created = await apiRequest<LedgerAdjustment>('/api/v1/ledger/adjustments', {
        method: 'POST',
        token: accessToken,
        body: { owner_user_id: filters.owner_user_id, amount_minor: amountMinor, direction, reason },
      })
      setAdjustOpen(false)
      setPending(created)
    } catch (caught) {
      toast.error(formError(caught, 'Could not create adjustment').banner)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (!accessToken || !pending || submitting) return
    setSubmitting(true)
    try {
      await apiRequest(`/api/v1/ledger/adjustments/${pending.id}/approve`, {
        method: 'POST',
        token: accessToken,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      setPending(null)
      toast.success('Adjustment approved')
      await load()
    } catch (caught) {
      toast.error(formError(caught, 'Could not approve').banner)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title={title} role={user.role} menus={menus}>
      <PageHeader
        title={title}
        action={
          isSuperAdmin && filters.owner_user_id ? (
            <PrimaryButton onClick={() => setAdjustOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adjust Balance
            </PrimaryButton>
          ) : null
        }
      />
      <FilterBar onApply={() => void setFilters({ page: 1 })} onClear={() => { void setFilters({ date_from: todayIso(), date_to: todayIso(), owner_user_id: '', bank_account_id: '', q: '', event_type: '', direction: '', page: 1, page_size: 100 }); void (!isSuperAdmin && load()) }} onReload={() => void load()}>
        {isSuperAdmin ? (
          <>
            <FormField label="Admin">
              <Select value={filters.owner_user_id} onChange={(event) => void setFilters({ owner_user_id: event.target.value, bank_account_id: '' })} aria-label="Admin">
                <option value="">Pick an Admin</option>
                {admins.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name} ({row.username})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Bank">
              <Select value={filters.bank_account_id} onChange={(event) => void setFilters({ bank_account_id: event.target.value, owner_user_id: '' })} aria-label="Bank">
                <option value="">Pick a bank</option>
                {banks.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        ) : null}
        <FormField label="From Date">
          <Input type="date" value={filters.date_from} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={filters.date_to} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="Search">
          <Input placeholder="Gateway Ref. No or UTR" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        <FormField label="Event type">
          <Select value={filters.event_type} onChange={(event) => void setFilters({ event_type: event.target.value })} aria-label="Event type">
            <option value="">All</option>
            {LEDGER_EVENT_TYPES.filter((value) => value !== 'OPENING').map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Direction">
          <Select value={filters.direction} onChange={(event) => void setFilters({ direction: event.target.value })} aria-label="Direction">
            <option value="">All</option>
            {LEDGER_DIRECTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        </FormField>
        <div>
          <ExportButton
            disabled={!statement || statement.pagination.total === 0}
            onExport={() => {
              const query = new URLSearchParams()
              if (filters.date_from) query.set('date_from', filters.date_from)
              if (filters.date_to) query.set('date_to', filters.date_to)
              if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
              if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
              if (filters.q) query.set('q', filters.q)
              if (filters.event_type) query.set('event_type', filters.event_type)
              if (filters.direction) query.set('direction', filters.direction)
              void downloadExport(`/api/v1/ledger/export?${query}`, accessToken, 'ledger.csv')
            }}
          />
        </div>
      </FilterBar>
      {adjustOpen ? (
        <div className="mb-4">
          <FormShell submitLabel="Create" onCancel={() => setAdjustOpen(false)} onSubmit={() => void handleCreate()}>
            <FormSection title="Adjust Ledger Balance" description="Manually insert an entry into the ledger.">
              <FormGrid>
                <FormField label="Direction" required>
                  <Select value={direction} onChange={(event) => setDirection(event.target.value as 'CREDIT' | 'DEBIT')}>
                    <option value="CREDIT">CREDIT</option>
                    <option value="DEBIT">DEBIT</option>
                  </Select>
                </FormField>
                <FormField label="Reason" required>
                  <Input value={reason} onChange={(event) => setReason(event.target.value)} />
                </FormField>
                <FormField label="Amount">
                  <MoneyInput id="amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title="Approve Adjustment?"
          subtitle={`This will post a ${pending.direction} of ₹${pending.amount_minor / 100} for reason "${pending.reason}".`}
          confirmLabel="Approve"
          variant="primary"
          loading={submitting}
          onConfirm={() => void handleApprove()}
          onCancel={() => setPending(null)}
        />
      ) : null}
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : null}
      <DataTable
        columns={[
          { key: 'when', heading: 'DATE & TIME' },
          { key: 'credit', heading: 'CREDIT' },
          { key: 'debit', heading: 'DEBIT' },
          { key: 'balance', heading: 'BALANCE' },
          { key: 'remark', heading: 'REMARK' },
          { key: 'ref', heading: 'Gateway Ref. No' },
          { key: 'utr', heading: 'UTR' },
        ]}
        rows={(statement?.lines ?? []).map((row) => ({
          when: new Date(row.created_at).toLocaleString(),
          credit: <MoneyDisplay amountMinor={row.credit_minor} />,
          debit: <MoneyDisplay amountMinor={row.debit_minor} />,
          balance: <MoneyDisplay amountMinor={row.balance_after_minor} />,
          remark: row.remark ?? '—',
          ref: row.reference ?? '—',
          utr: row.utr ?? '—',
        }))}
        empty={<EmptyState message="No ledger entries" />}
        pagination={statement?.pagination}
        onPage={(page) => void setFilters({ page })}
        onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
      />

    </AppShell>
  )
}
