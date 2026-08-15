'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type { BankAccountListItem, DashboardSummary, MerchantListItem, UpiAccountListItem, UserListItem } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, EmptyState, FilterBar, StatCard, TableSkeleton } from '@/components/ui/FilterBar'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const EMPTY: DashboardSummary = {
  payin: { amount_minor: 0, count: 0 },
  payout: { amount_minor: 0, count: 0 },
  commission: { amount_minor: 0, count: 0, margin_minor: 0 },
  inter_transfer: { amount_minor: 0, count: 0 },
  refunded_minor: 0,
  my_account_minor: null,
  admin_wise: [],
  pending_approvals: 0,
  failed_transactions: 0,
  unmatched_utrs: 0,
  operators_online: 0,
  pending_utrs: 0,
  assigned_queue_depth: 0,
  processed_today: 0,
  commission_by_kind: [
    { rate_kind: 'PAYIN', admin_commission_minor: 0, margin_minor: 0 },
    { rate_kind: 'PAYOUT', admin_commission_minor: 0, margin_minor: 0 },
  ],
}

export default function DashboardPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('DASHBOARD')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(todayIso()),
    date_to: parseAsString.withDefault(todayIso()),
    admin_user_id: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    bank_account_id: parseAsString.withDefault(''),
    upi_account_id: parseAsString.withDefault(''),
  })
  const [data, setData] = useState<DashboardSummary>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.admin_user_id) query.set('admin_user_id', filters.admin_user_id)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
    if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
    try {
      setData(await apiRequest<DashboardSummary>(`/api/v1/dashboard/summary?${query}`, { token: accessToken }))
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useEffect(() => {
    if (!accessToken || !allowed || user?.role !== 'SUPER_ADMIN') return
    void Promise.all([
      apiListRequest<UserListItem>('/api/v1/users?role=ADMIN&page_size=100', { token: accessToken }),
      apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }).catch(() => ({ items: [] as MerchantListItem[] })),
      apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken }),
      apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken }),
    ]).then(([adminRows, merchantRows, bankRows, upiRows]) => {
      setAdmins(adminRows.items)
      setMerchants(merchantRows.items)
      setBanks(bankRows.items)
      setUpis(upiRows.items)
    })
  }, [accessToken, allowed, user?.role])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const range = `date_from=${filters.date_from}&date_to=${filters.date_to}`
  const isAdmin = user.role === 'ADMIN' || user.role === 'OPERATOR'
  const isOperator = user.role === 'OPERATOR'

  return (
    <AppShell title={isAdmin ? 'Payment Gateway Overview' : 'TENANT OVERVIEW'} role={user.role} menus={menus}>
      <FilterBar
        onApply={() => void load()}
        onClear={() =>
          void setFilters({
            date_from: todayIso(),
            date_to: todayIso(),
            admin_user_id: '',
            merchant_id: '',
            bank_account_id: '',
            upi_account_id: '',
          })
        }
        onReload={() => void load()}
      >
        <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--qp-text-secondary)' }}>
          From
          <input
            className="h-8 rounded-lg border px-2 text-xs"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
            type="date"
            value={filters.date_from}
            onChange={(event) => void setFilters({ date_from: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--qp-text-secondary)' }}>
          To
          <input
            className="h-8 rounded-lg border px-2 text-xs"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
            type="date"
            value={filters.date_to}
            onChange={(event) => void setFilters({ date_to: event.target.value })}
          />
        </label>
        {user.role === 'SUPER_ADMIN' ? (
          <>
            <select
              className="h-8 rounded-lg border px-2 text-xs"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
              aria-label="Admin"
              value={filters.admin_user_id}
              onChange={(event) => void setFilters({ admin_user_id: event.target.value })}
            >
              <option value="">All Admins</option>
              {admins.map((row) => (
                <option key={row.id} value={row.id}>{row.username}</option>
              ))}
            </select>
            <select
              className="h-8 rounded-lg border px-2 text-xs"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
              aria-label="Merchant"
              value={filters.merchant_id}
              onChange={(event) => void setFilters({ merchant_id: event.target.value })}
            >
              <option value="">All Merchants</option>
              {merchants.map((row) => (
                <option key={row.id} value={row.id}>{row.display_name}</option>
              ))}
            </select>
            <select
              className="h-8 rounded-lg border px-2 text-xs"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
              aria-label="Bank"
              value={filters.bank_account_id}
              onChange={(event) => void setFilters({ bank_account_id: event.target.value })}
            >
              <option value="">All Banks</option>
              {banks.map((row) => (
                <option key={row.id} value={row.id}>{row.label}</option>
              ))}
            </select>
            <select
              className="h-8 rounded-lg border px-2 text-xs"
              style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-primary)', backgroundColor: '#fff' }}
              aria-label="UPI"
              value={filters.upi_account_id}
              onChange={(event) => void setFilters({ upi_account_id: event.target.value })}
            >
              <option value="">All UPIs</option>
              {upis.map((row) => (
                <option key={row.id} value={row.id}>{row.upi_address}</option>
              ))}
            </select>
          </>
        ) : null}
      </FilterBar>
      {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
      {loading ? <TableSkeleton /> : null}
      {isOperator ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="Assigned queue" href="/payin?status=ASSIGNED">{data.assigned_queue_depth}</StatCard>
          <StatCard label="Processed today" href={`/payin?status=SUCCESS&${range}`}>{data.processed_today}</StatCard>
          <StatCard label="Pending UTRs" href="/utr?status=PENDING">{data.pending_utrs}</StatCard>
          <StatCard label="Failed" href={`/transactions?status=FAILED&${range}`}>{data.failed_transactions}</StatCard>
        </div>
      ) : isAdmin ? (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Total Pay-in" href={`/payin?status=SUCCESS&${range}`}>
              <MoneyDisplay amountMinor={data.payin.amount_minor} />
            </StatCard>
            <StatCard label="Total Payout" href={`/payout?status=SUCCESS&${range}`}>
              <MoneyDisplay amountMinor={data.payout.amount_minor} />
            </StatCard>
            <StatCard label="Total Refunded" href={`/payin?status=REFUNDED&${range}`}>
              <MoneyDisplay amountMinor={data.refunded_minor} />
            </StatCard>
            <StatCard label="My Account" href="/ledger">
              <MoneyDisplay amountMinor={data.my_account_minor} />
            </StatCard>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Commission PAYIN" href={`/commission?${range}`}>
              <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYIN')?.admin_commission_minor} />
            </StatCard>
            <StatCard label="Commission PAYOUT" href={`/commission?${range}`}>
              <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYOUT')?.admin_commission_minor} />
            </StatCard>
            <StatCard label="Operators online">{data.operators_online}</StatCard>
            <StatCard label="Pending UTRs" href="/utr?status=PENDING">{data.pending_utrs}</StatCard>
            <StatCard label="Failed" href={`/transactions?status=FAILED&${range}`}>{data.failed_transactions}</StatCard>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="PAY-IN" href={`/payin?${range}`}>
              <MoneyDisplay amountMinor={data.payin.amount_minor} />
              <p className="text-[10px] text-zinc-500">{data.payin.count} txns</p>
            </StatCard>
            <StatCard label="PAY-OUT" href={`/payout?${range}`}>
              <MoneyDisplay amountMinor={data.payout.amount_minor} />
              <p className="text-[10px] text-zinc-500">{data.payout.count} txns</p>
            </StatCard>
            <StatCard label="COMMISSION" href={`/commission?${range}`}>
              <MoneyDisplay amountMinor={data.commission.amount_minor} />
              <p className="text-[10px] text-zinc-500">
                margin <MoneyDisplay amountMinor={data.commission.margin_minor} />
              </p>
            </StatCard>
            <StatCard label="INTER TRANSFER" href={`/inter-transfers?${range}`}>
              <MoneyDisplay amountMinor={data.inter_transfer.amount_minor} />
              <p className="text-[10px] text-zinc-500">{data.inter_transfer.count} transfers</p>
            </StatCard>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>Admin-wise performance</p>
          <DataTable
            columns={[
              { key: 'admin', heading: 'Admin' },
              { key: 'payin', heading: 'Pay-In' },
              { key: 'payout', heading: 'Pay-Out' },
              { key: 'commission', heading: 'Commission' },
              { key: 'margin', heading: 'Margin' },
            ]}
            rows={data.admin_wise.map((row) => ({
              admin: row.admin_username,
              payin: <MoneyDisplay amountMinor={row.payin_minor} />,
              payout: <MoneyDisplay amountMinor={row.payout_minor} />,
              commission: <MoneyDisplay amountMinor={row.commission_minor} />,
              margin: <MoneyDisplay amountMinor={row.margin_minor} />,
            }))}
            empty={<EmptyState message="No Admin activity in this range" />}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Pending approvals" href="/payout?status=PENDING">{data.pending_approvals}</StatCard>
            <StatCard label="Failed transactions" href={`/transactions?status=FAILED&${range}`}>{data.failed_transactions}</StatCard>
            <StatCard label="Unmatched UTRs" href="/utr?status=UNMATCHED">{data.unmatched_utrs}</StatCard>
            <StatCard label="Operators online">{data.operators_online}</StatCard>
          </div>
        </>
      )}
    </AppShell>
  )
}
