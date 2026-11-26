'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  DashboardInsights,
  DashboardMyAccountKind,
  DashboardSummary,
  MenuCode,
  MerchantListItem,
  UpiAccountListItem,
  UserListItem,
} from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, FilterBar, StatCard, type StatTone } from '@/components/ui/FilterBar'
import { BarChart, type BarDatum, type BarSeries } from '@/components/charts/BarChart'
import { ChartCard, ChartLegend, SegmentedToggle } from '@/components/charts/ChartCard'
import { StatusMix } from '@/components/charts/StatusMix'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { formatCompactCount, formatCompactMinor } from '@/lib/chart'
import { todayIsoIst } from '@/lib/datetime'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { canSeeMerchants } from '@/lib/merchant-visibility'
import { MoneyDisplay } from '@/lib/money'
import { useTenantScreen } from '@/lib/useTenantScreen'

const EMPTY: DashboardSummary = {
  payin: { amount_minor: 0, count: 0 },
  payout: { amount_minor: 0, count: 0 },
  commission: { amount_minor: 0, count: 0, margin_minor: 0 },
  hawala: { amount_minor: 0, count: 0 },
  refunded_minor: 0,
  my_account_minor: null,
  my_account_kind: null,
  my_account_owner_user_id: null,
  banker_wise: [],
  pending_approvals: 0,
  failed_transactions: 0,
  unmatched_utrs: 0,
  unclaimed_utrs: 0,
  unclaimed_amount_minor: 0,
  operators_online: 0,
  pending_utrs: 0,
  assigned_queue_depth: 0,
  processed_today: 0,
  commission_by_kind: [
    { rate_kind: 'PAYIN', banker_commission_minor: 0, margin_minor: 0 },
    { rate_kind: 'PAYOUT', banker_commission_minor: 0, margin_minor: 0 },
  ],
}

function myAccountHint(kind: DashboardMyAccountKind | null | undefined): string {
  if (kind === 'COMMISSION_PROFIT') return ''
  if (kind === 'EXCHANGE_POSITION') return 'Exchange position'
  if (kind === 'MY_ACCOUNT') return 'Platform margin + Hawala'
  if (kind === 'BANKER_BALANCE') return 'Live My Account balance'
  return 'Live balance'
}

function myAccountHref(
  kind: DashboardMyAccountKind | null | undefined,
  canView: (code: MenuCode) => boolean,
  ownerUserId?: string | null,
): string | undefined {
  if (kind === 'COMMISSION_PROFIT') return canView('COMMISSION') ? '/commission' : undefined
  if (kind === 'MY_ACCOUNT') {
    if (!canView('LEDGER')) return undefined
    return ownerUserId
      ? `/ledger?account_kind=MY_ACCOUNT&owner_user_id=${encodeURIComponent(ownerUserId)}`
      : '/ledger?account_kind=MY_ACCOUNT'
  }
  if (kind === 'BANKER_BALANCE') {
    if (!canView('LEDGER')) return undefined
    if (ownerUserId) {
      return `/ledger?account_kind=BANKER&owner_user_id=${encodeURIComponent(ownerUserId)}`
    }
    return '/ledger'
  }
  if (kind === 'EXCHANGE_POSITION') {
    if (canView('LEDGER')) return '/ledger'
    if (canView('TRANSACTIONS')) return '/transactions'
    if (canView('PAYIN')) return '/payin'
  }
  return undefined
}

const EMPTY_INSIGHTS: DashboardInsights = {
  granularity: 'DAY',
  timezone: 'Asia/Kolkata',
  trend: [],
  payin_status: [],
  payout_status: [],
  by_merchant: [],
}

type Metric = 'amount' | 'count'

const METRIC_OPTIONS: ReadonlyArray<{ id: Metric; label: string }> = [
  { id: 'amount', label: 'Amount' },
  { id: 'count', label: 'Count' },
]

const FLOW_SERIES: ReadonlyArray<BarSeries> = [
  { key: 'payin', label: 'Pay-in', color: 'var(--qp-primary)' },
  { key: 'payout', label: 'Pay-out', color: 'var(--qp-warning)' },
]

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--qp-text-muted)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError
    ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
    : fallback
}

export default function DashboardPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('DASHBOARD')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(todayIsoIst()),
    date_to: parseAsString.withDefault(todayIsoIst()),
    banker_user_id: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    bank_account_id: parseAsString.withDefault(''),
    upi_account_id: parseAsString.withDefault(''),
  })
  const [data, setData] = useState<DashboardSummary>(EMPTY)
  const [insights, setInsights] = useState<DashboardInsights>(EMPTY_INSIGHTS)
  const [error, setError] = useState<string | null>(null)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exchangeMetric, setExchangeMetric] = useState<Metric>('amount')
  const [admins, setAdmins] = useState<UserListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [upis, setUpis] = useState<UpiAccountListItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setInsightsError(null)
    const query = new URLSearchParams()
    if (filters.date_from) query.set('date_from', filters.date_from)
    if (filters.date_to) query.set('date_to', filters.date_to)
    if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
    if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
    if (filters.bank_account_id) query.set('bank_account_id', filters.bank_account_id)
    if (filters.upi_account_id) query.set('upi_account_id', filters.upi_account_id)
    const [summaryResult, insightsResult] = await Promise.allSettled([
      apiRequest<DashboardSummary>(`/api/v1/dashboard/summary?${query}`),
      apiRequest<DashboardInsights>(`/api/v1/dashboard/insights?${query}`),
    ])
    if (summaryResult.status === 'fulfilled') setData(summaryResult.value)
    else setError(errorText(summaryResult.reason, 'Could not load dashboard'))
    if (insightsResult.status === 'fulfilled') setInsights(insightsResult.value)
    else {
      setInsights(EMPTY_INSIGHTS)
      setInsightsError(errorText(insightsResult.reason, 'Could not load charts'))
    }
    setLoading(false)
  }, [filters.date_from, filters.date_to, filters.banker_user_id, filters.merchant_id, filters.bank_account_id, filters.upi_account_id])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useEffect(() => {
    if (!accessToken || !allowed) return
    const isSuperAdmin = user?.role === 'SUPER_ADMIN'
    const showMerchants = canSeeMerchants(user?.role)
    if (!isSuperAdmin && !showMerchants) return

    if (isSuperAdmin || user?.role === 'ADMIN') {
      void Promise.all([
        isSuperAdmin
          ? apiListRequest<UserListItem>('/api/v1/users?role=BANKER&page_size=100', { token: accessToken }).catch(
              () => ({ items: [] as UserListItem[] }),
            )
          : Promise.resolve({ items: [] as UserListItem[] }),
        showMerchants
          ? apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }).catch(() => ({
              items: [] as MerchantListItem[],
            }))
          : Promise.resolve({ items: [] as MerchantListItem[] }),
        isSuperAdmin
          ? apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken }).catch(
              () => ({ items: [] as BankAccountListItem[] }),
            )
          : Promise.resolve({ items: [] as BankAccountListItem[] }),
        isSuperAdmin
          ? apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken }).catch(() => ({
              items: [] as UpiAccountListItem[],
            }))
          : Promise.resolve({ items: [] as UpiAccountListItem[] }),
      ])
        .then(([adminRows, merchantRows, bankRows, upiRows]) => {
          setAdmins(adminRows.items)
          setMerchants(merchantRows.items)
          setBanks(bankRows.items)
          setUpis(upiRows.items)
        })
        .catch(() => {
          // Per-request catches above should absorb failures; keep the shell usable.
        })
    }
  }, [accessToken, allowed, user?.role])

  const canView = useCallback(
    (code: MenuCode) => menus.some((grant) => grant.menu_code === code && grant.can_view),
    [menus],
  )

  const range = `date_from=${filters.date_from}&date_to=${filters.date_to}`
  const payinHref = (extra: string) => (canView('PAYIN') ? `/payin?${extra}` : undefined)
  const payoutHref = (extra: string) => (canView('PAYOUT') ? `/payout?${extra}` : undefined)

  const exchangeData = useMemo<BarDatum[]>(
    () =>
      insights.by_merchant.map((row) => ({
        id: row.merchant_id,
        label: row.merchant_code,
        title: `${row.merchant_code} · ${row.merchant_name}`,
        values:
          exchangeMetric === 'amount'
            ? { payin: row.payin_minor, payout: row.payout_minor }
            : { payin: row.payin_count, payout: row.payout_count },
        href: canView('PAYIN') ? `/payin?status=COMPLETED&merchant_id=${row.merchant_id}&${range}` : undefined,
      })),
    [insights.by_merchant, exchangeMetric, canView, range],
  )

  const bankerData = useMemo<BarDatum[]>(
    () =>
      data.banker_wise.map((row) => ({
        id: row.banker_user_id,
        label: row.banker_username,
        values: { payin: row.payin_minor, payout: row.payout_minor },
        href: canView('PAYIN') ? `/payin?status=COMPLETED&banker_user_id=${row.banker_user_id}&${range}` : undefined,
      })),
    [data.banker_wise, canView, range],
  )

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const isAdmin = user.role === 'BANKER' || user.role === 'OPERATOR'
  const isOperator = user.role === 'OPERATOR'
  const isSuperView = !isAdmin
  const showExchanges = canSeeMerchants(user.role)
  const failedHref = canView('TRANSACTIONS') ? `/transactions?status=REJECTED&${range}` : undefined
  const pendingPayins = insights.payin_status
    .filter((slice) => slice.status === 'INITIATE' || slice.status === 'IN_PROCESS')
    .reduce((sum, slice) => sum + slice.count, 0)
  const attention = (count: number): StatTone => (count > 0 ? 'warning' : 'neutral')
  const problem = (count: number): StatTone => (count > 0 ? 'danger' : 'neutral')
  const balanceTone = (amount: number): StatTone => (amount < 0 ? 'danger' : amount > 0 ? 'success' : 'primary')
  const formatMoneyAxis = (value: number) => formatCompactMinor(value)
  const formatCountAxis = (value: number) => formatCompactCount(Math.round(value))
  const formatMoneyValue = (value: number) => <MoneyDisplay amountMinor={value} />
  const formatCountValue = (value: number) => `${value} txns`

  const kpiStrip = (
    <div className="grid grid-cols-2 gap-qp-gap">
      <StatCard label="Pending Pay-ins" tone={attention(pendingPayins)} hint="INITIATE + IN_PROCESS" href={payinHref(`status=IN_PROCESS&${range}`)}>
        {pendingPayins}
      </StatCard>
      <StatCard label="Refunded" tone={problem(data.refunded_minor)} href={payinHref(`status=REFUND&${range}`)}>
        <MoneyDisplay amountMinor={data.refunded_minor} />
      </StatCard>
    </div>
  )

  const showBankerPerformance = isSuperView && user.role !== 'MERCHANT'

  const statusMixCard = (
    <ChartCard title="Status mix" subtitle="All rows created in range" loading={loading} error={insightsError}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatusMix
          title="Pay-in"
          slices={insights.payin_status}
          hrefFor={(status) =>
            status === 'EXPIRED'
              ? payinHref(`status=REJECTED&review_reason=EXPIRED&${range}`)
              : payinHref(`status=${status}&${range}`)
          }
        />
        <StatusMix
          title="Pay-out"
          slices={insights.payout_status}
          hrefFor={(status) => payoutHref(`status=${status}&${range}`)}
        />
      </div>
    </ChartCard>
  )

  const bankerTableCard = showBankerPerformance ? (
    <ChartCard
      title={`${bankerLabel()}-wise`}
      subtitle="Commission and margin in range"
      loading={loading}
      empty={data.banker_wise.length === 0}
      emptyMessage={`No ${bankerLabel()} activity in this range`}
    >
      <DataTable
        columns={[
          { key: 'admin', heading: bankerLabel() },
          { key: 'payin', heading: 'Pay-In', align: 'right' },
          { key: 'payout', heading: 'Pay-Out', align: 'right' },
          { key: 'commission', heading: 'Commission', align: 'right' },
          { key: 'margin', heading: 'Margin', align: 'right' },
        ]}
        rows={data.banker_wise.map((row) => ({
          admin: row.banker_username,
          payin: <MoneyDisplay amountMinor={row.payin_minor} />,
          payout: <MoneyDisplay amountMinor={row.payout_minor} />,
          commission: <MoneyDisplay amountMinor={row.commission_minor} />,
          margin: <MoneyDisplay amountMinor={row.margin_minor} />,
        }))}
        empty={<EmptyState message={`No ${bankerLabel()} activity in this range`} />}
      />
    </ChartCard>
  ) : null

  return (
    <AppShell title={isAdmin ? 'Payment Gateway Overview' : 'TENANT OVERVIEW'} role={user.role} menus={menus}>
      <FilterBar
        onApply={() => void load()}
        onClear={() =>
          void setFilters({
            date_from: todayIsoIst(),
            date_to: todayIsoIst(),
            banker_user_id: '',
            merchant_id: '',
            bank_account_id: '',
            upi_account_id: '',
          })
        }
        onReload={() => void load()}
      >
        <FormField label="From Date">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(event) => void setFilters({ date_from: event.target.value })}
          />
        </FormField>
        <FormField label="To Date">
          <Input
            type="date"
            value={filters.date_to}
            onChange={(event) => void setFilters({ date_to: event.target.value })}
          />
        </FormField>
        {user.role === 'SUPER_ADMIN' ? (
          <>
            <FormField label={bankerLabel()}>
              <Select
                aria-label={bankerLabel()}
                value={filters.banker_user_id}
                onChange={(event) => void setFilters({ banker_user_id: event.target.value })}
              >
                <option value="">All {bankerLabel({ plural: true })}</option>
                {admins.map((row) => (
                  <option key={row.id} value={row.id}>{row.username}</option>
                ))}
              </Select>
            </FormField>
            <FormField label={merchantLabel()}>
              <Select
                aria-label={merchantLabel()}
                value={filters.merchant_id}
                onChange={(event) => void setFilters({ merchant_id: event.target.value })}
              >
                <option value="">All {merchantLabel({ plural: true })}</option>
                {merchants.map((row) => (
                  <option key={row.id} value={row.id}>{row.display_name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Bank">
              <Select
                aria-label="Bank"
                value={filters.bank_account_id}
                onChange={(event) => void setFilters({ bank_account_id: event.target.value })}
              >
                <option value="">All Banks</option>
                {banks.map((row) => (
                  <option key={row.id} value={row.id}>{row.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="UPI">
              <Select
                aria-label="UPI"
                value={filters.upi_account_id}
                onChange={(event) => void setFilters({ upi_account_id: event.target.value })}
              >
                <option value="">All UPIs</option>
                {upis.map((row) => (
                  <option key={row.id} value={row.id}>{row.upi_address}</option>
                ))}
              </Select>
            </FormField>
          </>
        ) : user.role === 'ADMIN' ? (
          <FormField label={merchantLabel()}>
            <Select
              aria-label={merchantLabel()}
              value={filters.merchant_id}
              onChange={(event) => void setFilters({ merchant_id: event.target.value })}
            >
              <option value="">All {merchantLabel({ plural: true })}</option>
              {merchants.map((row) => (
                <option key={row.id} value={row.id}>{row.display_name}</option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </FilterBar>
      {error ? (
        <div className="mb-qp-gap">
          <ErrorAlert message={error} />
        </div>
      ) : null}
      <div className="space-y-5" aria-busy={loading}>
        <DashboardSection title={isOperator ? 'Queue' : 'Volume'}>
        {isOperator ? (
          <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-5">
            <StatCard label="Assigned queue" tone={attention(data.assigned_queue_depth)} href={payinHref('status=IN_PROCESS')}>{data.assigned_queue_depth}</StatCard>
            <StatCard label="Processed today" tone={data.processed_today > 0 ? 'success' : 'neutral'} href={payinHref(`status=COMPLETED&${range}`)}>{data.processed_today}</StatCard>
            <StatCard label="Pending UTRs" tone={attention(data.pending_utrs)} href={canView('UTR') ? '/utr?status=PENDING' : undefined}>{data.pending_utrs}</StatCard>
            <StatCard label="Failed" tone={problem(data.failed_transactions)} href={failedHref}>{data.failed_transactions}</StatCard>
            {data.my_account_minor !== null ? (
              <StatCard
                label="My Account"
                tone={balanceTone(data.my_account_minor)}
                hint={myAccountHint(data.my_account_kind)}
                href={myAccountHref(data.my_account_kind, canView, data.my_account_owner_user_id)}
              >
                <MoneyDisplay amountMinor={data.my_account_minor} />
              </StatCard>
            ) : null}
          </div>
        ) : isAdmin ? (
          <div className="space-y-qp-gap">
            <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-4">
              <StatCard label="Total Pay-in" tone="success" hint={`${data.payin.count} txns`} href={payinHref(`status=COMPLETED&${range}`)}>
                <MoneyDisplay amountMinor={data.payin.amount_minor} />
              </StatCard>
              <StatCard label="Total Payout" tone="warning" hint={`${data.payout.count} txns`} href={payoutHref(`status=COMPLETED&${range}`)}>
                <MoneyDisplay amountMinor={data.payout.amount_minor} />
              </StatCard>
              <StatCard label="Total Refunded" tone={problem(data.refunded_minor)} href={payinHref(`status=REFUND&${range}`)}>
                <MoneyDisplay amountMinor={data.refunded_minor} />
              </StatCard>
              {data.my_account_minor !== null ? (
                <StatCard
                  label="My Account"
                  tone={balanceTone(data.my_account_minor)}
                  hint={myAccountHint(data.my_account_kind)}
                  href={myAccountHref(data.my_account_kind, canView, data.my_account_owner_user_id)}
                >
                  <MoneyDisplay amountMinor={data.my_account_minor} />
                </StatCard>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-qp-gap sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Commission PAYIN" tone="success" href={canView('COMMISSION') ? `/commission?${range}` : undefined}>
                <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYIN')?.banker_commission_minor} />
              </StatCard>
              <StatCard label="Commission PAYOUT" tone="success" href={canView('COMMISSION') ? `/commission?${range}` : undefined}>
                <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYOUT')?.banker_commission_minor} />
              </StatCard>
              <StatCard label="Operators online" tone={data.operators_online > 0 ? 'success' : 'neutral'} href={canView('USERS') ? '/users?role=OPERATOR' : undefined}>{data.operators_online}</StatCard>
              <StatCard label="Pending UTRs" tone={attention(data.pending_utrs)} href={canView('UTR') ? '/utr?status=PENDING' : undefined}>{data.pending_utrs}</StatCard>
              <StatCard label="Unclaimed UTRs" tone={attention(data.unclaimed_utrs)} href={canView('UTR') ? '/utr?status=UNCLAIMED' : undefined}>
                <MoneyDisplay amountMinor={data.unclaimed_amount_minor} />
                <p className="text-[10px] text-zinc-500">{data.unclaimed_utrs} entries</p>
              </StatCard>
              <StatCard label="Failed" tone={problem(data.failed_transactions)} href={failedHref}>{data.failed_transactions}</StatCard>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="PAY-IN" tone="success" hint={`${data.payin.count} txns`} href={payinHref(`status=COMPLETED&${range}`)}>
              <MoneyDisplay amountMinor={data.payin.amount_minor} />
            </StatCard>
            <StatCard label="PAY-OUT" tone="warning" hint={`${data.payout.count} txns`} href={payoutHref(`status=COMPLETED&${range}`)}>
              <MoneyDisplay amountMinor={data.payout.amount_minor} />
            </StatCard>
            <StatCard
              label="COMMISSION"
              tone="success"
              hint={<>margin <MoneyDisplay amountMinor={data.commission.margin_minor} /></>}
              href={canView('COMMISSION') ? `/commission?${range}` : undefined}
            >
              <MoneyDisplay amountMinor={data.commission.amount_minor} />
            </StatCard>
            <StatCard label="HAWALA" tone="info" hint={`${data.hawala.count} transfers`} href={canView('HAWALA') ? `/hawala?${range}` : undefined}>
              <MoneyDisplay amountMinor={data.hawala.amount_minor} />
            </StatCard>
            {data.my_account_minor !== null ? (
              <StatCard
                label="My Account"
                tone={balanceTone(data.my_account_minor)}
                hint={myAccountHint(data.my_account_kind)}
                href={myAccountHref(data.my_account_kind, canView, data.my_account_owner_user_id)}
              >
                <MoneyDisplay amountMinor={data.my_account_minor} />
              </StatCard>
            ) : null}
          </div>
        )}
        </DashboardSection>

        {isSuperView ? null : (
          <DashboardSection title="Needs attention">{kpiStrip}</DashboardSection>
        )}

        <DashboardSection title="Activity">
          {showExchanges || showBankerPerformance ? (
            <div className={`grid grid-cols-1 items-start gap-qp-gap ${showExchanges && showBankerPerformance ? 'xl:grid-cols-2' : ''}`}>
              {showExchanges ? (
                <ChartCard
                  title="Exchange Total Pay-in"
                  subtitle={`Top ${merchantLabel({ plural: true })} by completed volume · click a bar to open its Pay-ins`}
                  loading={loading}
                  error={insightsError}
                  empty={insights.by_merchant.length === 0}
                  emptyMessage={`No completed ${merchantLabel()} volume in this range`}
                  actions={
                    <>
                      <ChartLegend items={FLOW_SERIES} />
                      <SegmentedToggle label="Exchange metric" value={exchangeMetric} options={METRIC_OPTIONS} onChange={setExchangeMetric} />
                    </>
                  }
                >
                  <BarChart
                    ariaLabel="Exchange Total Pay-in"
                    data={exchangeData}
                    series={FLOW_SERIES}
                    formatAxis={exchangeMetric === 'amount' ? formatMoneyAxis : formatCountAxis}
                    formatValue={exchangeMetric === 'amount' ? formatMoneyValue : formatCountValue}
                    height={220}
                  />
                </ChartCard>
              ) : null}
              {showBankerPerformance ? (
                <ChartCard
                  title={`${bankerLabel()} Total Pay-in`}
                  subtitle={`Completed volume per ${bankerLabel()}`}
                  loading={loading}
                  empty={data.banker_wise.length === 0}
                  emptyMessage={`No ${bankerLabel()} activity in this range`}
                  actions={<ChartLegend items={FLOW_SERIES} />}
                >
                  <BarChart
                    ariaLabel={`${bankerLabel()} Total Pay-in`}
                    data={bankerData}
                    series={FLOW_SERIES}
                    formatAxis={formatMoneyAxis}
                    formatValue={formatMoneyValue}
                    height={220}
                  />
                </ChartCard>
              ) : null}
            </div>
          ) : null}
          <div className={`grid grid-cols-1 items-start gap-qp-gap ${bankerTableCard ? 'xl:grid-cols-2' : ''}`}>
            {bankerTableCard}
            {statusMixCard}
          </div>
        </DashboardSection>
      </div>
    </AppShell>
  )
}
