'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  GeneralPosition,
  GeneralSection,
  GeneralSide,
  GeneralSynthetic,
  GeneralSyntheticKey,
} from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { ExportButton, TableSkeleton, StatCard } from '@/components/ui/FilterBar'
import { apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
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
              As of {new Date(position.as_of).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
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
                ? `Position Clearing of ${Math.abs(clearing.amount_minor)} paise is present. Totals match, but investigate null-merchant ledger rows or incomplete Hawala legs.`
                : `Out of balance by ${Math.abs(position!.difference_minor)} paise. This is a data-integrity alarm — totals should match.`
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
            />
            <PositionColumn
              title="LIABILITIES (Debit)"
              tone="debit"
              side={position.debit}
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
}: {
  title: string
  tone: 'credit' | 'debit'
  side: GeneralSide
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
              <SectionBlock key={section.key} section={section} />
            ))}
            {side.synthetics.map((synthetic) => (
              <SyntheticRow key={synthetic.key} synthetic={synthetic} />
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

function SectionBlock({ section }: { section: GeneralSection }) {
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
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-[var(--qp-text)]">{row.name}</td>
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-[var(--qp-text-secondary)]">{row.code}</td>
          <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-right tabular-nums">
            <MoneyDisplay amountMinor={row.amount_minor} />
          </td>
        </tr>
      ))}
    </>
  )
}

function SyntheticRow({ synthetic }: { synthetic: GeneralSynthetic }) {
  return (
    <tr className="border-t border-[var(--qp-border)] bg-[var(--qp-warning-bg)]">
      <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] font-medium text-[var(--qp-text)]" colSpan={2}>
        {SYNTHETIC_LABELS[synthetic.key]}
      </td>
      <td className="px-[var(--qp-cell-px)] py-[var(--qp-cell-py)] text-right tabular-nums">
        <MoneyDisplay amountMinor={synthetic.amount_minor} />
      </td>
    </tr>
  )
}
