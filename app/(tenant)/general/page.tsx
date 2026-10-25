'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type {
  GeneralPosition,
  GeneralRow,
  GeneralSection,
  GeneralSectionKey,
  GeneralSide,
  GeneralSynthetic,
  GeneralSyntheticKey,
  MenuGrant,
} from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ExportButton, TableSkeleton, StatCard } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { formatDateTimeIst } from '@/lib/datetime'
import { downloadExport } from '@/lib/export'
import { fromMinor } from '@quickerpay/money'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useTenantScreen } from '@/lib/useTenantScreen'

const SYNTHETIC_LABELS: Record<GeneralSyntheticKey, string> = {
  PENDING_WITHDRAWAL: 'Pending Withdrawal',
  IN_PROCESS_WITHDRAWAL: 'In Process Withdrawal',
  ADVANCE_CHARGES: 'Advance Charges',
  LEDGER_ADJUSTMENTS: 'Ledger Adjustments',
  POSITION_CLEARING: 'Position Clearing',
}

const SECTION_LABELS: Record<string, string> = {
  PARTY: 'PARTY',
  BANKER: 'BANKER',
  EXCHANGE: 'EXCHANGE',
  AGENT: 'AGENT',
}

const DRILL_LINK_CLASS =
  'font-medium text-[var(--qp-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qp-primary)]'

function hrefForGeneralRow(sectionKey: GeneralSectionKey, row: GeneralRow): string | null {
  if (sectionKey === 'BANKER') {
    return `/ledger?account_kind=BANKER&owner_user_id=${encodeURIComponent(row.id)}`
  }
  if (sectionKey === 'PARTY') {
    return `/ledger?account_kind=PARTY&party_id=${encodeURIComponent(row.id)}`
  }
  if (sectionKey === 'EXCHANGE') {
    if (row.id === 'unallocated') return null
    return `/ledger?account_kind=EXCHANGE&merchant_id=${encodeURIComponent(row.id)}`
  }
  if (sectionKey === 'AGENT') {
    return `/ledger?account_kind=AGENT&agent_user_id=${encodeURIComponent(row.id)}`
  }
  return null
}

function hrefForSynthetic(key: GeneralSyntheticKey): string | null {
  if (key === 'ADVANCE_CHARGES') return '/commission'
  if (key === 'PENDING_WITHDRAWAL') return '/payout?status=INITIATE'
  if (key === 'IN_PROCESS_WITHDRAWAL') return '/payout?status=INITIATE&assigned=true'
  return null
}

function menuAllowsHref(menus: MenuGrant[], href: string): boolean {
  if (href.startsWith('/ledger')) return hasMenu(menus, 'LEDGER', 'can_view')
  if (href.startsWith('/commission')) return hasMenu(menus, 'COMMISSION', 'can_view')
  if (href.startsWith('/payout')) return hasMenu(menus, 'PAYOUT', 'can_view')
  return false
}

function DrillLabel({
  href,
  menus,
  children,
}: {
  href: string | null
  menus: MenuGrant[]
  children: ReactNode
}) {
  if (!href || !menuAllowsHref(menus, href)) {
    return <>{children}</>
  }
  return (
    <Link href={href} className={DRILL_LINK_CLASS}>
      {children}
    </Link>
  )
}

export default function GeneralPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('GENERAL')
  const [position, setPosition] = useState<GeneralPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<GeneralPosition>('/api/v1/general/position', { token: accessToken })
      setPosition(result)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load General Management')
      setPosition(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const canExport = hasMenu(menus, 'GENERAL', 'can_export')
  const clearing =
    position?.credit.synthetics.find((row) => row.key === 'POSITION_CLEARING') ??
    position?.debit.synthetics.find((row) => row.key === 'POSITION_CLEARING')
  const outOfBalance = position !== null && (position.difference_minor !== 0 || !!clearing)

  return (
    <AppShell title="General Management" role={user.role} menus={menus}>
      <PageHeader
        title="General Management"
        meta={
          position ? (
            <span>
              As of {formatDateTimeIst(position.as_of)}
            </span>
          ) : null
        }
        action={
          <div className="flex items-center gap-2">
            <PrimaryButton onClick={() => void load()}>Reload</PrimaryButton>
            <ExportButton
              disabled={!position || loading}
              canExport={canExport}
              onExport={() => {
                void downloadExport(
                  '/api/v1/general/position/export?format=xlsx',
                  accessToken,
                  'general-position.xlsx',
                ).catch((caught) => {
                  toast.error(caught instanceof ApiClientError ? caught.message : 'Export failed')
                })
              }}
            />
          </div>
        }
      />
      <div className="mb-qp-gap flex flex-col gap-qp-gap">
        <ErrorAlert message={error} />
        {outOfBalance ? (
          <ErrorAlert
            message={
              clearing
                ? `Position Clearing of ${fromMinor(BigInt(Math.abs(clearing.amount_minor)))} is present. Totals match, but investigate null-merchant ledger rows or incomplete Hawala legs.`
                : `Out of balance by ${fromMinor(BigInt(Math.abs(position!.difference_minor)))}. This is a data-integrity alarm — totals should match.`
            }
            type="error"
          />
        ) : null}
      </div>

      {loading && !position ? (
        <TableSkeleton />
      ) : !position ? (
        <p className="rounded-qp-card border border-[var(--qp-border)] bg-[var(--qp-card)] p-qp-card text-[13px] text-[var(--qp-text-secondary)]">
          No position data yet.
        </p>
      ) : (
        <>
          <div className="mb-qp-gap grid gap-qp-gap sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Credit" tone="success">
              <MoneyDisplay amountMinor={position.credit.total_minor} />
            </StatCard>
            <StatCard label="Total Debit" tone="danger">
              <MoneyDisplay amountMinor={-position.debit.total_minor} />
            </StatCard>
          </div>

          <div className="grid gap-qp-gap lg:grid-cols-2">
            <PositionColumn
              title="ASSETS (Credit)"
              tone="credit"
              side={position.credit}
              menus={menus}
            />
            <PositionColumn
              title="LIABILITIES (Debit)"
              tone="debit"
              side={position.debit}
              menus={menus}
            />
          </div>
        </>
      )}
    </AppShell>
  )
}

function PositionColumn({
  title,
  tone,
  side,
  menus,
}: {
  title: string
  tone: 'credit' | 'debit'
  side: GeneralSide
  menus: MenuGrant[]
}) {
  const headerClass =
    tone === 'credit'
      ? 'bg-[var(--qp-success)] text-white'
      : 'bg-[var(--qp-danger)] text-white'
  const empty =
    side.sections.length === 0 && side.synthetics.length === 0

  return (
    <section className="overflow-hidden rounded-qp-card border border-[var(--qp-border)] bg-[var(--qp-card)] shadow-[var(--qp-shadow-sm)]">
      <header className={`px-qp-card py-2 text-[12px] font-semibold tracking-wide ${headerClass}`}>
        {title}
      </header>
      <div className="overflow-x-auto">
        <table className="qp-table qp-table--bordered min-w-full text-left text-qp-body">
          <thead className="border-b border-[var(--qp-border)] bg-[var(--qp-surface)] text-qp-th uppercase tracking-wide text-[var(--qp-text-secondary)]">
            <tr>
              <th className="px-[var(--qp-cell-px)] py-[var(--qp-th-py)] font-medium">Name</th>
              <th className="px-[var(--qp-cell-px)] py-[var(--qp-th-py)] font-medium">Code</th>
              <th className="px-[var(--qp-cell-px)] py-[var(--qp-th-py)] text-right font-medium">
                {tone === 'credit' ? 'Credit' : 'Debit'}
              </th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={3} className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-center text-[var(--qp-text-secondary)]">
                  No rows
                </td>
              </tr>
            ) : null}
            {side.sections.map((section) => (
              <SectionBlock key={section.key} section={section} menus={menus} />
            ))}
            {side.synthetics.map((synthetic) => (
              <SyntheticRow key={synthetic.key} synthetic={synthetic} menus={menus} />
            ))}
            <tr className="border-t border-[var(--qp-border)] bg-[var(--qp-surface)] font-semibold">
              <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)]" colSpan={2}>
                Total {tone === 'credit' ? 'Credit' : 'Debit'}
              </td>
              <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-right tabular-nums">
                <MoneyDisplay amountMinor={side.total_minor} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SectionBlock({
  section,
  menus,
}: {
  section: GeneralSection
  menus: MenuGrant[]
}) {
  return (
    <>
      <tr className="bg-[var(--qp-surface)]">
        <td
          colSpan={3}
          className="px-[var(--qp-cell-px)] py-[calc(var(--qp-cell-py)/2)] text-[11px] font-semibold uppercase tracking-wide text-[var(--qp-text-secondary)]"
        >
          {SECTION_LABELS[section.key] ?? section.key}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.id} className="border-t border-[var(--qp-border)]">
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-[var(--qp-text)]">
            <DrillLabel href={hrefForGeneralRow(section.key, row)} menus={menus}>
              {row.name}
            </DrillLabel>
          </td>
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-[var(--qp-text-secondary)]">{row.code}</td>
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-right tabular-nums">
            <MoneyDisplay amountMinor={row.amount_minor} />
          </td>
        </tr>
      ))}
    </>
  )
}

function SyntheticRow({
  synthetic,
  menus,
}: {
  synthetic: GeneralSynthetic
  menus: MenuGrant[]
}) {
  return (
    <tr className="border-t border-[var(--qp-border)] bg-[var(--qp-warning-bg)]">
      <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] font-medium text-[var(--qp-text)]" colSpan={2}>
        <DrillLabel href={hrefForSynthetic(synthetic.key)} menus={menus}>
          {SYNTHETIC_LABELS[synthetic.key]}
        </DrillLabel>
      </td>
      <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-right tabular-nums">
        <MoneyDisplay amountMinor={synthetic.amount_minor} />
      </td>
    </tr>
  )
}
