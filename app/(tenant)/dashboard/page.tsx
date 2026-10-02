'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  DashboardInsights,
  DashboardSummary,
  MenuCode,
  MerchantListItem,
  UpiAccountListItem,
  UserListItem,
} from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, FilterBar, StatCard } from '@/components/ui/FilterBar'
import { BarChart, type BarDatum, type BarSeries } from '@/components/charts/BarChart'
import { ChartCard, ChartLegend, SegmentedToggle } from '@/components/charts/ChartCard'
import { StatusMix } from '@/components/charts/StatusMix'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { averageMinor, bucketLabel, formatCompactCount, formatCompactMinor, successRate } from '@/lib/chart'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { canSeeMerchants } from '@/lib/merchant-visibility'
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
  hawala: { amount_minor: 0, count: 0 },
  refunded_minor: 0,
  my_account_minor: null,
  banker_wise: [],
  pending_approvals: 0,
  failed_transactions: 0,
  unmatched_utrs: 0,
  operators_online: 0,
  pending_utrs: 0,
  assigned_queue_depth: 0,
  processed_today: 0,
  commission_by_kind: [
    { rate_kind: 'PAYIN', banker_commission_minor: 0, margin_minor: 0 },
    { rate_kind: 'PAYOUT', banker_commission_minor: 0, margin_minor: 0 },
  ],
}

const EMPTY_INSIGHTS: DashboardInsights = {
  granularity: 'DAY',
  timezone: 'Asia/Kolkata',
  trend: [],
  payin_status: [],
  payout_status: [],
  by_merchant: [],
  by_bank: [],
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

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError
    ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
    : fallback
}

export default function DashboardPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('DASHBOARD')
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(todayIso()),
    date_to: parseAsString.withDefault(todayIso()),
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
  const [trendMetric, setTrendMetric] = useState<Metric>('amount')
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
          ? apiListRequest<UserListItem>('/api/v1/users?role=BANKER&page_size=100', { token: accessToken })
          : Promise.resolve({ items: [] as UserListItem[] }),
        showMerchants
          ? apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100', { token: accessToken }).catch(() => ({
              items: [] as MerchantListItem[],
            }))
          : Promise.resolve({ items: [] as MerchantListItem[] }),
        isSuperAdmin
          ? apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100', { token: accessToken })
          : Promise.resolve({ items: [] as BankAccountListItem[] }),
        isSuperAdmin
          ? apiListRequest<UpiAccountListItem>('/api/v1/upi-accounts?page_size=100', { token: accessToken }).catch(() => ({
              items: [] as UpiAccountListItem[],
            }))
          : Promise.resolve({ items: [] as UpiAccountListItem[] }),
      ]).then(([adminRows, merchantRows, bankRows, upiRows]) => {
        setAdmins(adminRows.items)
        setMerchants(merchantRows.items)
        setBanks(bankRows.items)
        setUpis(upiRows.items)
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

  const trendData = useMemo<BarDatum[]>(
    () =>
      insights.trend.map((point) => {
        const day = point.bucket.slice(0, 10)
        return {
          id: point.bucket,
          label: bucketLabel(point.bucket, insights.granularity),
          title: insights.granularity === 'HOUR' ? `${day} ${point.bucket.slice(11, 16)} IST` : day,
          values:
            trendMetric === 'amount'
              ? { payin: point.payin_minor, payout: point.payout_minor }
              : { payin: point.payin_count, payout: point.payout_count },
          href: canView('PAYIN') ? `/payin?status=COMPLETED&date_from=${day}&date_to=${day}` : undefined,
        }
      }),
    [insights.trend, insights.granularity, trendMetric, canView],
  )

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

  const bankData = useMemo<BarDatum[]>(
    () =>
      insights.by_bank.map((row) => ({
        id: row.bank_account_id,
        label: row.label,
        values: { payin: row.payin_minor, payout: row.payout_minor },
        href: canView('BANKS') ? `/banks/${row.bank_account_id}` : undefined,
      })),
    [insights.by_bank, canView],
  )

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const isAdmin = user.role === 'BANKER' || user.role === 'OPERATOR'
  const isOperator = user.role === 'OPERATOR'
  const isSuperView = !isAdmin
  const showExchanges = canSeeMerchants(user.role)
  const failedHref = canView('TRANSACTIONS') ? `/transactions?status=REJECTED&${range}` : undefined
  const payinSuccess = successRate(insights.payin_status)
  const payoutSuccess = successRate(insights.payout_status)
  const avgPayin = averageMinor(data.payin.amount_minor, data.payin.count)
  const avgPayout = averageMinor(data.payout.amount_minor, data.payout.count)
  const netFlow = data.payin.amount_minor - data.payout.amount_minor
  const granularityLabel = insights.granularity === 'HOUR' ? 'Hourly, IST' : 'Daily, IST'
  const trendEmpty = !insights.trend.some((point) => point.payin_count > 0 || point.payout_count > 0)
  const formatMoneyAxis = (value: number) => formatCompactMinor(value)
  const formatCountAxis = (value: number) => formatCompactCount(Math.round(value))
  const formatMoneyValue = (value: number) => <MoneyDisplay amountMinor={value} />
  const formatCountValue = (value: number) => `${value} txns`

  const kpiStrip = (
    <div className="grid grid-cols-2 gap-qp-gap sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Pay-in success" tone="success" hint="Completed ÷ (completed + rejected)" href={payinHref(`status=COMPLETED&${range}`)}>
        {payinSuccess ?? '—'}
      </StatCard>
      <StatCard label="Pay-out success" tone="success" hint="Completed ÷ (completed + rejected)" href={payoutHref(`status=COMPLETED&${range}`)}>
        {payoutSuccess ?? '—'}
      </StatCard>
      <StatCard label="Avg Pay-in ticket" tone="info" hint={`${data.payin.count} completed`}>
        <MoneyDisplay amountMinor={avgPayin} />
      </StatCard>
      <StatCard label="Avg Pay-out ticket" tone="info" hint={`${data.payout.count} completed`}>
        <MoneyDisplay amountMinor={avgPayout} />
      </StatCard>
      <StatCard label="Net flow" tone={netFlow < 0 ? 'warning' : 'primary'} hint="Pay-in − Pay-out">
        <MoneyDisplay amountMinor={netFlow} />
      </StatCard>
      <StatCard label="Refunded" tone="neutral" href={payinHref(`status=REFUND&${range}`)}>
        <MoneyDisplay amountMinor={data.refunded_minor} />
      </StatCard>
    </div>
  )

  const trendCard = (
    <ChartCard
      title="Pay-in vs Pay-out trend"
      subtitle={`Completed volume · ${granularityLabel}`}
      loading={loading}
      error={insightsError}
      empty={trendEmpty}
      emptyMessage="No completed Pay-in or Pay-out in this range"
      className="lg:col-span-2"
      actions={
        <>
          <ChartLegend items={FLOW_SERIES} />
          <SegmentedToggle label="Trend metric" value={trendMetric} options={METRIC_OPTIONS} onChange={setTrendMetric} />
        </>
      }
    >
      <BarChart
        ariaLabel="Pay-in vs Pay-out trend"
        data={trendData}
        series={FLOW_SERIES}
        formatAxis={trendMetric === 'amount' ? formatMoneyAxis : formatCountAxis}
        formatValue={trendMetric === 'amount' ? formatMoneyValue : formatCountValue}
        maxLabels={insights.granularity === 'HOUR' ? 12 : 16}
      />
    </ChartCard>
  )

  const statusCard = (
    <ChartCard title="Status mix" subtitle="All rows created in range" loading={loading} error={insightsError}>
      <div className="space-y-3">
        <StatusMix
          title="Pay-in"
          slices={insights.payin_status}
          hrefFor={(status) => payinHref(`status=${status}&${range}`)}
        />
        <StatusMix
          title="Pay-out"
          slices={insights.payout_status}
          hrefFor={(status) => payoutHref(`status=${status}&${range}`)}
        />
      </div>
    </ChartCard>
  )

  const bankCard = (
    <ChartCard
      title="Bank Total Pay-in"
      subtitle="Top bank accounts by completed volume"
      loading={loading}
      error={insightsError}
      empty={insights.by_bank.length === 0}
      emptyMessage="No completed bank volume in this range"
      actions={<ChartLegend items={FLOW_SERIES} />}
    >
      <BarChart
        ariaLabel="Bank Total Pay-in"
        data={bankData}
        series={FLOW_SERIES}
        formatAxis={formatMoneyAxis}
        formatValue={formatMoneyValue}
        height={180}
      />
    </ChartCard>
  )

  return (
    <AppShell title={isAdmin ? 'Payment Gateway Overview' : 'TENANT OVERVIEW'} role={user.role} menus={menus}>
      <FilterBar
        onApply={() => void load()}
        onClear={() =>
          void setFilters({
            date_from: todayIso(),
            date_to: todayIso(),
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
      <div className="space-y-qp-gap" aria-busy={loading}>
        {isOperator ? (
          <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-4">
            <StatCard label="Assigned queue" tone="info" href={payinHref('status=IN_PROCESS')}>{data.assigned_queue_depth}</StatCard>
            <StatCard label="Processed today" tone="success" href={payinHref(`status=COMPLETED&${range}`)}>{data.processed_today}</StatCard>
            <StatCard label="Pending UTRs" tone="warning" href={canView('UTR') ? '/utr?status=PENDING' : undefined}>{data.pending_utrs}</StatCard>
            <StatCard label="Failed" tone="danger" href={failedHref}>{data.failed_transactions}</StatCard>
          </div>
        ) : isAdmin ? (
          <>
            <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-4">
              <StatCard label="Total Pay-in" tone="primary" hint={`${data.payin.count} txns`} href={payinHref(`status=COMPLETED&${range}`)}>
                <MoneyDisplay amountMinor={data.payin.amount_minor} />
              </StatCard>
              <StatCard label="Total Payout" tone="warning" hint={`${data.payout.count} txns`} href={payoutHref(`status=COMPLETED&${range}`)}>
                <MoneyDisplay amountMinor={data.payout.amount_minor} />
              </StatCard>
              <StatCard label="Total Refunded" tone="neutral" href={payinHref(`status=REFUND&${range}`)}>
                <MoneyDisplay amountMinor={data.refunded_minor} />
              </StatCard>
              <StatCard label="My Account" tone="info" hint="Live balance" href={canView('LEDGER') ? '/ledger' : undefined}>
                <MoneyDisplay amountMinor={data.my_account_minor} />
              </StatCard>
            </div>
            <div className="grid grid-cols-2 gap-qp-gap sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Commission PAYIN" tone="success" href={canView('COMMISSION') ? `/commission?${range}` : undefined}>
                <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYIN')?.banker_commission_minor} />
              </StatCard>
              <StatCard label="Commission PAYOUT" tone="success" href={canView('COMMISSION') ? `/commission?${range}` : undefined}>
                <MoneyDisplay amountMinor={data.commission_by_kind.find((row) => row.rate_kind === 'PAYOUT')?.banker_commission_minor} />
              </StatCard>
              <StatCard label="Operators online" tone="info" href={canView('USERS') ? '/users?role=OPERATOR' : undefined}>{data.operators_online}</StatCard>
              <StatCard label="Pending UTRs" tone="warning" href={canView('UTR') ? '/utr?status=PENDING' : undefined}>{data.pending_utrs}</StatCard>
              <StatCard label="Failed" tone="danger" href={failedHref}>{data.failed_transactions}</StatCard>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-4">
            <StatCard label="PAY-IN" tone="primary" hint={`${data.payin.count} txns`} href={payinHref(`status=COMPLETED&${range}`)}>
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
          </div>
        )}

        {kpiStrip}

        <div className="grid grid-cols-1 gap-qp-gap lg:grid-cols-3">
          {trendCard}
          {statusCard}
        </div>

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

        {isSuperView && user.role !== 'MERCHANT' ? (
          <div className="grid grid-cols-1 gap-qp-gap lg:grid-cols-2">
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
                height={180}
              />
            </ChartCard>
            {bankCard}
          </div>
        ) : user.role !== 'MERCHANT' ? (
          bankCard
        ) : null}

        {isSuperView && user.role !== 'MERCHANT' ? (
          <section aria-label={`${bankerLabel()}-wise performance`}>
            <p className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--qp-text-secondary)' }}>{bankerLabel()}-wise performance</p>
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
          </section>
        ) : null}

        {isSuperView ? (
          <div className="grid grid-cols-2 gap-qp-gap md:grid-cols-4">
            <StatCard label="Pending approvals" tone="warning" href={payoutHref('status=INITIATE')}>{data.pending_approvals}</StatCard>
            <StatCard label="Failed transactions" tone="danger" href={failedHref}>{data.failed_transactions}</StatCard>
            <StatCard label="Unmatched UTRs" tone="warning" href={canView('UTR') ? '/utr?status=PENDING' : undefined}>{data.unmatched_utrs}</StatCard>
            <StatCard label="Operators online" tone="info" href={canView('USERS') ? '/users?role=OPERATOR' : undefined}>{data.operators_online}</StatCard>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
