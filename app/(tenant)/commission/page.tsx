'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import type { CommissionEntry, CommissionSummary } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, StatCard, TableSkeleton } from '@/components/ui/FilterBar'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay, RateDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'

const EMPTY: CommissionSummary = {
  kinds: [
    {
      rate_kind: 'PAYIN',
      eligible_volume_minor: 0,
      merchant_commission_minor: 0,
      admin_commission_minor: 0,
      margin_minor: 0,
      reversals_minor: 0,
      net_minor: 0,
    },
    {
      rate_kind: 'PAYOUT',
      eligible_volume_minor: 0,
      merchant_commission_minor: 0,
      admin_commission_minor: 0,
      margin_minor: 0,
      reversals_minor: 0,
      net_minor: 0,
    },
  ],
  total: {
    eligible_volume_minor: 0,
    merchant_commission_minor: 0,
    admin_commission_minor: 0,
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
    admin_user_id: parseAsString.withDefault(''),
    merchant_id: parseAsString.withDefault(''),
  })
  const dateFrom = filters.date_from
  const dateTo = filters.date_to
  const rateKind = filters.rate_kind
  const adminUserId = filters.admin_user_id
  const merchantId = filters.merchant_id
  const [summary, setSummary] = useState<CommissionSummary>(EMPTY)
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const hideMargin = user?.role === 'ADMIN'

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    if (dateFrom) query.set('date_from', dateFrom)
    if (dateTo) query.set('date_to', dateTo)
    if (rateKind) query.set('rate_kind', rateKind)
    if (adminUserId) query.set('admin_user_id', adminUserId)
    if (merchantId) query.set('merchant_id', merchantId)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    try {
      const [nextSummary, nextEntries] = await Promise.all([
        apiRequest<CommissionSummary>(`/api/v1/commission/summary${suffix}`, { token: accessToken }),
        apiRequest<CommissionEntry[]>(`/api/v1/commission/entries${suffix}`, { token: accessToken }),
      ])
      setSummary(nextSummary)
      setEntries(nextEntries)
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}`
          : 'Could not load commission',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, dateFrom, dateTo, rateKind, adminUserId, merchantId])

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

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'COMMISSION')) return <ForbiddenPage permission="COMMISSION.can_view" />

  const payinKind = summary.kinds.find((row) => row.rate_kind === 'PAYIN') ?? EMPTY.kinds[0]!
  const payoutKind = summary.kinds.find((row) => row.rate_kind === 'PAYOUT') ?? EMPTY.kinds[1]!

  const handleClear = () => {
    void setFilters({ date_from: '', date_to: '', rate_kind: '', admin_user_id: '', merchant_id: '' })
  }

  return (
    <AppShell title="Commission" role={user.role} menus={menus}>
      <PageHeader
        title="Commission"
      />
      <FilterBar onApply={() => void load()} onClear={handleClear} onReload={() => void load()}>
        <FormField label="From Date">
          <Input type="date" value={dateFrom} onChange={(event) => void setFilters({ date_from: event.target.value })} aria-label="Start Date" />
        </FormField>
        <FormField label="To Date">
          <Input type="date" value={dateTo} onChange={(event) => void setFilters({ date_to: event.target.value })} aria-label="End Date" />
        </FormField>
        <FormField label="Rate Kind">
          <Select value={rateKind} onChange={(event) => void setFilters({ rate_kind: event.target.value })} aria-label="Rate kind">
            <option value="">All kinds</option>
            <option value="PAYIN">PAYIN</option>
            <option value="PAYOUT">PAYOUT</option>
          </Select>
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={admins}
            merchants={merchants}
            adminId={adminUserId}
            merchantId={merchantId}
            onAdminChange={(value) => void setFilters({ admin_user_id: value })}
            onMerchantChange={(value) => void setFilters({ merchant_id: value })}
          />
        ) : null}
        <div>
          <ExportButton
            disabled={entries.length === 0}
            onExport={() => {
              const query = new URLSearchParams()
              if (dateFrom) query.set('date_from', dateFrom)
              if (dateTo) query.set('date_to', dateTo)
              if (rateKind) query.set('rate_kind', rateKind)
              if (adminUserId) query.set('admin_user_id', adminUserId)
              if (merchantId) query.set('merchant_id', merchantId)
              void downloadExport(`/api/v1/commission/export?${query}`, 'commission.csv', accessToken!)
            }}
          />
        </div>
      </FilterBar>
      <div className="mb-4">
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
            <SummaryRow label="Merchant commission" a={payinKind.merchant_commission_minor} b={payoutKind.merchant_commission_minor} c={summary.total.merchant_commission_minor} />
            <SummaryRow label="Admin commission" a={payinKind.admin_commission_minor} b={payoutKind.admin_commission_minor} c={summary.total.admin_commission_minor} />
            {hideMargin ? null : (
              <SummaryRow label="Your margin" a={payinKind.margin_minor} b={payoutKind.margin_minor} c={summary.total.margin_minor} />
            )}
            <SummaryRow label="Reversals" a={payinKind.reversals_minor} b={payoutKind.reversals_minor} c={summary.total.reversals_minor} />
            <SummaryRow label={hideMargin ? 'Net' : 'Net margin'} a={payinKind.net_minor} b={payoutKind.net_minor} c={summary.total.net_minor} />
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
          { key: 'created_at', heading: 'Created' },
          { key: 'rate_kind', heading: 'Kind' },
          { key: 'eligible', heading: 'Eligible volume' },
          { key: 'merchant_rate', heading: 'Merchant rate' },
          { key: 'admin_rate', heading: 'Admin rate' },
          { key: 'merchant', heading: 'Merchant commission' },
          { key: 'admin', heading: 'Admin commission' },
          ...(hideMargin ? [] : [{ key: 'margin', heading: 'Margin' }]),
        ]}
        rows={entries.map((row) => ({
          created_at: row.created_at,
          rate_kind: row.rate_kind,
          eligible: <MoneyDisplay amountMinor={row.eligible_amount_minor} />,
          merchant_rate: <RateDisplay rateBp={row.merchant_rate_bp} />,
          admin_rate: <RateDisplay rateBp={row.admin_rate_bp} />,
          merchant: <MoneyDisplay amountMinor={row.merchant_commission_minor} />,
          admin: <MoneyDisplay amountMinor={row.admin_commission_minor} />,
          margin: <MoneyDisplay amountMinor={row.margin_minor} />,
        }))}
        empty={<EmptyState message="No records match these filters" onClear={handleClear} />}
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
