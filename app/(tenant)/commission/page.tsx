'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type { CommissionEntry, CommissionSummary, Pagination } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, StatCard, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { formatDateTimeIst } from '@/lib/datetime'
import { downloadExport } from '@/lib/export'
import { agentLabel, bankerLabel, merchantLabel } from '@/lib/labels'
import { MoneyDisplay, RateDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'

const EMPTY: CommissionSummary = {
  kinds: [
    {
      rate_kind: 'PAYIN',
      eligible_volume_minor: 0,
      merchant_commission_minor: 0,
      banker_commission_minor: 0,
      agent_commission_minor: 0,
      margin_minor: 0,
      reversals_minor: 0,
      net_minor: 0,
    },
    {
      rate_kind: 'PAYOUT',
      eligible_volume_minor: 0,
      merchant_commission_minor: 0,
      banker_commission_minor: 0,
      agent_commission_minor: 0,
      margin_minor: 0,
      reversals_minor: 0,
      net_minor: 0,
    },
  ],
  total: {
    eligible_volume_minor: 0,
    merchant_commission_minor: 0,
    banker_commission_minor: 0,
    agent_commission_minor: 0,
    margin_minor: 0,
    reversals_minor: 0,
    net_minor: 0,
  },
}

export default function CommissionPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [filters, setFilters] = useQueryStates({
    date_from: parseAsString.withDefault(''),
    date_to: parseAsString.withDefault(''),
    rate_kind: parseAsString.withDefault(''),
    banker_user_id: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
    show_deleted_unclaimed: parseAsBoolean.withDefault(false),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [summary, setSummary] = useState<CommissionSummary>(EMPTY)
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const buildQuery = useCallback(
    (includePage: boolean) => {
      const query = new URLSearchParams()
      if (includePage) {
        query.set('page', String(filters.page))
        query.set('page_size', String(filters.page_size))
      }
      if (filters.date_from) query.set('date_from', filters.date_from)
      if (filters.date_to) query.set('date_to', filters.date_to)
      if (filters.rate_kind) query.set('rate_kind', filters.rate_kind)
      if (filters.banker_user_id) query.set('banker_user_id', filters.banker_user_id)
      if (filters.merchant_id) query.set('merchant_id', filters.merchant_id)
      if (filters.show_deleted_unclaimed) query.set('show_deleted_unclaimed', 'true')
      return query
    },
    [
      filters.page,
      filters.page_size,
      filters.date_from,
      filters.date_to,
      filters.rate_kind,
      filters.banker_user_id,
      filters.merchant_id,
      filters.show_deleted_unclaimed,
    ],
  )

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const listQuery = buildQuery(true)
    const summaryQuery = buildQuery(false)
    const listSuffix = listQuery.toString() ? `?${listQuery.toString()}` : ''
    const summarySuffix = summaryQuery.toString() ? `?${summaryQuery.toString()}` : ''
    try {
      const [nextSummary, listed] = await Promise.all([
        apiRequest<CommissionSummary>(`/api/v1/commission/summary${summarySuffix}`, { token: accessToken }),
        apiListRequest<CommissionEntry>(`/api/v1/commission/entries${listSuffix}`, { token: accessToken }),
      ])
      setSummary(nextSummary)
      setEntries(listed.items)
      setPagination(listed.pagination)
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Could not load commission',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, buildQuery])

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!hasMenu(menus, 'COMMISSION')) return
    void load()
  }, [ready, user, menus, load, router])

  if (!ready) return <p className="p-qp-card text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'COMMISSION')) return <ForbiddenPage permission="COMMISSION.can_view" />

  const payinKind = summary.kinds.find((row) => row.rate_kind === 'PAYIN') ?? EMPTY.kinds[0]!
  const payoutKind = summary.kinds.find((row) => row.rate_kind === 'PAYOUT') ?? EMPTY.kinds[1]!
  const showMerchant = payinKind.merchant_commission_minor !== undefined
  const showBanker = payinKind.banker_commission_minor !== undefined
  const showAgent = payinKind.agent_commission_minor !== undefined
  const showBroker = payinKind.banker_agent_commission_minor !== undefined
  const showMargin = payinKind.margin_minor !== undefined

  const handleClear = () => {
    void setFilters({
      date_from: '',
      date_to: '',
      rate_kind: '',
      banker_user_id: '',
      merchant_id: '',
      show_deleted_unclaimed: false,
      page: 1,
      page_size: 10,
    })
  }

  return (
    <AppShell title="Commission" role={user.role} menus={menus}>
      <FilterBar
        onApply={() => {
          if (filters.page !== 1) void setFilters({ page: 1 })
          else void load()
        }}
        onClear={handleClear}
        onReload={() => void load()}
        actions={
          <ExportButton
            disabled={(pagination?.total ?? 0) === 0}
            onExport={() => {
              const query = buildQuery(false)
              void downloadExport(`/api/v1/commission/export?${query}`, accessToken, 'commission.csv')
            }}
          />
        }
      >
        <FormField label="From Date">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(event) => void setFilters({ date_from: event.target.value, page: 1 })}
            aria-label="Start Date"
          />
        </FormField>
        <FormField label="To Date">
          <Input
            type="date"
            value={filters.date_to}
            onChange={(event) => void setFilters({ date_to: event.target.value, page: 1 })}
            aria-label="End Date"
          />
        </FormField>
        <FormField label="Rate Kind">
          <Select
            value={filters.rate_kind}
            onChange={(event) => void setFilters({ rate_kind: event.target.value, page: 1 })}
            aria-label="Rate kind"
          >
            <option value="">All kinds</option>
            <option value="PAYIN">PAYIN</option>
            <option value="PAYOUT">PAYOUT</option>
          </Select>
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            adminId={filters.banker_user_id}
            merchantId={filters.merchant_id}
            onAdminChange={(value) => void setFilters({ banker_user_id: value, page: 1 })}
            onMerchantChange={(value) => void setFilters({ merchant_id: value, page: 1 })}
          />
        ) : null}
        <FormField label="Show deleted unclaimed">
          <div className="flex h-10 items-center px-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
              checked={filters.show_deleted_unclaimed}
              onChange={(event) =>
                void setFilters({ show_deleted_unclaimed: event.target.checked, page: 1 })
              }
              aria-label="Show deleted unclaimed"
            />
          </div>
        </FormField>
      </FilterBar>
      <div className="mb-qp-gap">
        <ErrorAlert message={error} />
      </div>
      {loading ? <TableSkeleton /> : null}
      <div className="mb-3 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-2 py-1 text-left font-medium" />
              <th className="px-2 py-1 text-right font-medium">PAY-IN</th>
              <th className="px-2 py-1 text-right font-medium">PAY-OUT</th>
              <th className="px-2 py-1 text-right font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow label="Eligible volume" a={payinKind.eligible_volume_minor} b={payoutKind.eligible_volume_minor} c={summary.total.eligible_volume_minor} />
            {showMerchant ? (
              <SummaryRow label={`${merchantLabel()} commission`} a={payinKind.merchant_commission_minor ?? 0} b={payoutKind.merchant_commission_minor ?? 0} c={summary.total.merchant_commission_minor ?? 0} />
            ) : null}
            {showBanker ? (
              <SummaryRow label={`${bankerLabel()} commission`} a={payinKind.banker_commission_minor ?? 0} b={payoutKind.banker_commission_minor ?? 0} c={summary.total.banker_commission_minor ?? 0} />
            ) : null}
            {showAgent ? (
              <SummaryRow label={`${agentLabel()} (Exchange) commission`} a={payinKind.agent_commission_minor ?? 0} b={payoutKind.agent_commission_minor ?? 0} c={summary.total.agent_commission_minor ?? 0} />
            ) : null}
            {showBroker ? (
              <SummaryRow label={`${agentLabel()} (Banker) commission`} a={payinKind.banker_agent_commission_minor ?? 0} b={payoutKind.banker_agent_commission_minor ?? 0} c={summary.total.banker_agent_commission_minor ?? 0} />
            ) : null}
            {showMargin ? (
              <SummaryRow label="Your margin" a={payinKind.margin_minor ?? 0} b={payoutKind.margin_minor ?? 0} c={summary.total.margin_minor ?? 0} />
            ) : null}
            <SummaryRow label="Reversals" a={payinKind.reversals_minor} b={payoutKind.reversals_minor} c={summary.total.reversals_minor} />
            <SummaryRow label={showMargin ? 'Net margin' : 'Net'} a={payinKind.net_minor} b={payoutKind.net_minor} c={summary.total.net_minor} />
          </tbody>
        </table>
      </div>
      <div className="mb-2 grid grid-cols-3 gap-2">
        <StatCard label="PAY-IN eligible">
          <MoneyDisplay amountMinor={payinKind.eligible_volume_minor} />
        </StatCard>
        <StatCard label="PAY-OUT eligible">
          <MoneyDisplay amountMinor={payoutKind.eligible_volume_minor} />
        </StatCard>
        <StatCard label="Net">
          <MoneyDisplay amountMinor={summary.total.net_minor} />
        </StatCard>
      </div>
      <DataTable
        columns={[
          { key: 'created_at', heading: 'Created', nowrap: true },
          { key: 'rate_kind', heading: 'Kind' },
          { key: 'utr', heading: 'UTR', nowrap: true },
          { key: 'eligible', heading: 'Eligible volume' },
          ...(showMerchant
            ? [
                { key: 'merchant_rate', heading: `${merchantLabel()} rate` },
                { key: 'merchant', heading: `${merchantLabel()} commission` },
              ]
            : []),
          ...(showBanker
            ? [
                { key: 'admin_rate', heading: `${bankerLabel()} rate` },
                { key: 'admin', heading: `${bankerLabel()} commission` },
              ]
            : []),
          ...(showAgent
            ? [
                { key: 'agent_rate', heading: `${agentLabel()} (Exchange) rate` },
                { key: 'agent', heading: `${agentLabel()} (Exchange) commission` },
              ]
            : []),
          ...(showBroker
            ? [
                { key: 'broker_rate', heading: `${agentLabel()} (Banker) rate` },
                { key: 'broker', heading: `${agentLabel()} (Banker) commission` },
              ]
            : []),
          ...(showMargin ? [{ key: 'margin', heading: 'Margin' }] : []),
        ]}
        rows={entries.map((row) => ({
          created_at: formatDateTimeIst(row.created_at),
          rate_kind: row.reversed ? (
            <span className="inline-flex items-center gap-1.5">
              {row.rate_kind}
              <StatusBadge status="REVERSED" />
            </span>
          ) : (
            row.rate_kind
          ),
          utr: row.utr ?? '—',
          eligible: <MoneyDisplay amountMinor={row.eligible_amount_minor} />,
          merchant_rate: <RateDisplay rateBp={row.merchant_rate_bp} />,
          admin_rate: <RateDisplay rateBp={row.banker_rate_bp} />,
          agent_rate: <RateDisplay rateBp={row.agent_rate_bp} />,
          broker_rate: <RateDisplay rateBp={row.banker_agent_rate_bp} />,
          merchant: <MoneyDisplay amountMinor={row.merchant_commission_minor} />,
          admin: <MoneyDisplay amountMinor={row.banker_commission_minor} />,
          agent: <MoneyDisplay amountMinor={row.agent_commission_minor} />,
          broker: <MoneyDisplay amountMinor={row.banker_agent_commission_minor} />,
          margin: <MoneyDisplay amountMinor={row.margin_minor} />,
        }))}
        empty={<EmptyState message="No records match these filters" onClear={handleClear} />}
        pagination={pagination ?? undefined}
        onPage={(page) => void setFilters({ page })}
        onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
      />
    </AppShell>
  )
}

function SummaryRow({
  label,
  a,
  b,
  c,
}: {
  label: string
  a: number
  b: number
  c: number
}) {
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-2 py-1">{label}</td>
      <td className="px-2 py-1 text-right">
        <MoneyDisplay amountMinor={a} />
      </td>
      <td className="px-2 py-1 text-right">
        <MoneyDisplay amountMinor={b} />
      </td>
      <td className="px-2 py-1 text-right">
        <MoneyDisplay amountMinor={c} />
      </td>
    </tr>
  )
}
