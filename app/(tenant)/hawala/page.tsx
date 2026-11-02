'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  HawalaListItem,
  HawalaPartyKind,
  HawalaStatus,
  MerchantListItem,
  PartyListItem,
} from '@quickerpay/shared-types'
import { HAWALA_PARTY_KINDS, HAWALA_STATUSES } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { DataTable, EmptyState, ExportButton, FilterBar, StatusBadge } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { formatDateTimeIst } from '@/lib/datetime'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { fromMinor } from '@quickerpay/money'
import { hasMenu, useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

interface DirectoryUser {
  id: string
  username: string
  display_name: string
  role: string
}

function kindLabel(kind: HawalaPartyKind): string {
  if (kind === 'MERCHANT') return 'Exchange Master'
  if (kind === 'PARTY') return 'Party'
  if (kind === 'AGENT') return 'Agent'
  return 'Banker'
}

interface SideBalance {
  balance_minor: number
  label: string
}

/** Positive = we owe that side; negative = that side owes us. */
function PositionText({ label, amountMinor }: { label: string; amountMinor: number | null }) {
  if (amountMinor === null) return null
  if (amountMinor < 0) {
    return (
      <>
        {label} owes us <MoneyDisplay amountMinor={-amountMinor} />
      </>
    )
  }
  if (amountMinor > 0) {
    return (
      <>
        we owe {label} <MoneyDisplay amountMinor={amountMinor} />
      </>
    )
  }
  return <>{label} settled</>
}

export default function HawalaPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [rows, setRows] = useState<HawalaListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<HawalaStatus | ''>('')
  const [filterDebitKind, setFilterDebitKind] = useState<HawalaPartyKind | ''>('')
  const [filterCreditKind, setFilterCreditKind] = useState<HawalaPartyKind | ''>('')
  const [filterDebitId, setFilterDebitId] = useState('')
  const [filterCreditId, setFilterCreditId] = useState('')

  const [debitKind, setDebitKind] = useState<HawalaPartyKind>('PARTY')
  const [creditKind, setCreditKind] = useState<HawalaPartyKind>('BANKER')
  const [debitId, setDebitId] = useState('')
  const [creditId, setCreditId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [remark, setRemark] = useState('')
  const [utr, setUtr] = useState('')
  const [debitBal, setDebitBal] = useState<SideBalance | null>(null)
  const [creditBal, setCreditBal] = useState<SideBalance | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [parties, setParties] = useState<PartyListItem[]>([])
  const [merchants, setMerchants] = useState<MerchantListItem[]>([])
  const [bankers, setBankers] = useState<DirectoryUser[]>([])
  const [agents, setAgents] = useState<DirectoryUser[]>([])
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [acting, setActing] = useState(false)

  const portalMode = user?.role === 'MERCHANT' || user?.role === 'BANKER'
  const pageTitle = portalMode ? 'Inter Transfer' : 'Hawala'
  const canCreate =
    !portalMode &&
    (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') &&
    hasMenu(menus, 'HAWALA', 'can_create')
  const canApprove = !portalMode && user?.role === 'SUPER_ADMIN' && hasMenu(menus, 'HAWALA', 'can_approve')
  const canView = hasMenu(menus, 'HAWALA')

  const perspectiveDirection = (row: HawalaListItem): 'DEBIT' | 'CREDIT' => {
    if (user?.role === 'MERCHANT' && user.merchant_id) {
      return row.debit.kind === 'MERCHANT' && row.debit.id === user.merchant_id ? 'DEBIT' : 'CREDIT'
    }
    if (user?.role === 'BANKER') {
      return row.debit.kind === 'BANKER' && row.debit.id === user.id ? 'DEBIT' : 'CREDIT'
    }
    return 'DEBIT'
  }

  const listQueryParams = useCallback(
    (
      overrides: {
        page?: number
        q?: string
        dateFrom?: string
        dateTo?: string
        statusFilter?: HawalaStatus | ''
        filterDebitKind?: HawalaPartyKind | ''
        filterCreditKind?: HawalaPartyKind | ''
        filterDebitId?: string
        filterCreditId?: string
        clearAll?: boolean
      } = {},
    ) => {
      const cleared = overrides.clearAll === true
      const pageValue = overrides.page ?? page
      const qValue = cleared ? '' : (overrides.q ?? q)
      const fromValue = cleared ? '' : (overrides.dateFrom ?? dateFrom)
      const toValue = cleared ? '' : (overrides.dateTo ?? dateTo)
      const statusValue = cleared ? '' : (overrides.statusFilter ?? statusFilter)
      const debitKindValue = cleared ? '' : (overrides.filterDebitKind ?? filterDebitKind)
      const creditKindValue = cleared ? '' : (overrides.filterCreditKind ?? filterCreditKind)
      const debitIdValue = cleared ? '' : (overrides.filterDebitId ?? filterDebitId)
      const creditIdValue = cleared ? '' : (overrides.filterCreditId ?? filterCreditId)
      const query = new URLSearchParams({ page: String(pageValue), page_size: '25' })
      if (qValue) query.set('q', qValue)
      if (fromValue) query.set('date_from', fromValue)
      if (toValue) query.set('date_to', toValue)
      if (statusValue) query.set('status', statusValue)
      if (debitKindValue) query.set('debit_kind', debitKindValue)
      if (creditKindValue) query.set('credit_kind', creditKindValue)
      if (debitKindValue && debitIdValue) query.set('debit_id', debitIdValue)
      if (creditKindValue && creditIdValue) query.set('credit_id', creditIdValue)
      return query
    },
    [
      page,
      q,
      dateFrom,
      dateTo,
      statusFilter,
      filterDebitKind,
      filterCreditKind,
      filterDebitId,
      filterCreditId,
    ],
  )

  const loadHistory = useCallback(
    async (overrides?: Parameters<typeof listQueryParams>[0]) => {
      if (!accessToken) return
      setError(null)
      const query = listQueryParams(overrides)
      try {
        const result = await apiListRequest<HawalaListItem>(`/api/v1/hawala?${query}`, {
          token: accessToken,
        })
        setRows(result.items)
        setTotal(result.pagination.total)
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : 'Could not load Hawala')
      }
    },
    [accessToken, listQueryParams],
  )

  const loadDirectories = useCallback(async () => {
    if (!accessToken || !canView || portalMode) return
    try {
      const [partyRes, merchantRes, userRes, agentRes] = await Promise.all([
        apiListRequest<PartyListItem>('/api/v1/parties?page_size=100&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as PartyListItem[] })),
        apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as MerchantListItem[] })),
        apiListRequest<DirectoryUser>('/api/v1/users?page_size=100&role=BANKER&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as DirectoryUser[] })),
        apiListRequest<DirectoryUser>('/api/v1/agents?page_size=100&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as DirectoryUser[] })),
      ])
      setParties(partyRes.items)
      setMerchants(merchantRes.items)
      setBankers(userRes.items)
      setAgents(agentRes.items)
    } catch {
      /* directories optional when menus are missing */
    }
  }, [accessToken, canView, portalMode])

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!hasMenu(menus, 'HAWALA')) return
    void loadHistory()
    void loadDirectories()
  }, [ready, user, menus, loadHistory, loadDirectories, router])

  useEffect(() => {
    if (!accessToken || !debitId) {
      setDebitBal(null)
      return
    }
    void apiRequest<SideBalance>(`/api/v1/hawala/balance?kind=${debitKind}&id=${debitId}`, { token: accessToken })
      .then(setDebitBal)
      .catch(() => setDebitBal(null))
  }, [accessToken, debitKind, debitId])

  useEffect(() => {
    if (!accessToken || !creditId) {
      setCreditBal(null)
      return
    }
    void apiRequest<SideBalance>(`/api/v1/hawala/balance?kind=${creditKind}&id=${creditId}`, { token: accessToken })
      .then(setCreditBal)
      .catch(() => setCreditBal(null))
  }, [accessToken, creditKind, creditId])

  if (!ready) return <p className="p-qp-card text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'HAWALA')) return <ForbiddenPage permission="HAWALA.can_view" />

  const optionsFor = (kind: HawalaPartyKind) => {
    if (kind === 'PARTY') {
      return parties.map((row) => ({ id: row.id, label: `${row.party_code} — ${row.display_name}` }))
    }
    if (kind === 'MERCHANT') {
      return merchants.map((row) => ({ id: row.id, label: row.display_name }))
    }
    if (kind === 'AGENT') {
      return agents.map((row) => ({ id: row.id, label: row.display_name || row.username }))
    }
    return bankers.map((row) => ({ id: row.id, label: row.display_name || row.username }))
  }

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/api/v1/hawala', {
        method: 'POST',
        token: accessToken,
        headers: { 'Idempotency-Key': `haw-ui-${Date.now()}` },
        body: {
          debit: { kind: debitKind, id: debitId },
          credit: { kind: creditKind, id: creditId },
          amount_minor: amountMinor,
          remark: remark || undefined,
          utr: utr || undefined,
        },
      })
      toast.success('Hawala submitted — waiting for Super Admin')
      setAmountMinor(0)
      setRemark('')
      setUtr('')
      await loadHistory()
      if (debitId) {
        const bal = await apiRequest<SideBalance>(`/api/v1/hawala/balance?kind=${debitKind}&id=${debitId}`, { token: accessToken })
        setDebitBal(bal)
      }
      if (creditId) {
        const bal = await apiRequest<SideBalance>(`/api/v1/hawala/balance?kind=${creditKind}&id=${creditId}`, { token: accessToken })
        setCreditBal(bal)
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecide = async () => {
    if (!accessToken || !confirm || acting) return
    setActing(true)
    setError(null)
    try {
      await apiRequest(`/api/v1/hawala/${confirm.id}/${confirm.action}`, {
        method: 'POST',
        token: accessToken,
        body: confirm.action === 'reject' ? {} : undefined,
      })
      toast.success(confirm.action === 'approve' ? 'Hawala approved' : 'Hawala rejected')
      setConfirm(null)
      await loadHistory()
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  // Debit (From) gives money: its balance rises. Credit (To) receives: its balance falls.
  const debitEffective =
    debitBal && amountMinor > 0 ? debitBal.balance_minor + amountMinor : debitBal?.balance_minor ?? null
  const creditEffective =
    creditBal && amountMinor > 0 ? creditBal.balance_minor - amountMinor : creditBal?.balance_minor ?? null
  const confirmRow = confirm ? rows.find((row) => row.id === confirm.id) ?? null : null

  return (
    <AppShell title={pageTitle} role={user.role} menus={menus}>
      <PageHeader title={pageTitle} />
      <ErrorAlert message={error} />

      {canCreate ? (
        <div className="mb-qp-gap">
          <FormShell
            title="Submit Hawala"
            submitLabel={submitting ? 'Submitting…' : 'Submit Hawala'}
            loading={submitting}
            onSubmit={() => void handleSubmit()}
          >
            <p className="mb-qp-gap text-xs text-[var(--qp-text-muted)]">
              CRM Hawala waits for Super Admin. Money does not move until Approve.
            </p>
            <FormSection title="Parties">
              <FormGrid>
                <FormField label="Debit (From) kind" required>
                  <Select
                    value={debitKind}
                    onChange={(event) => {
                      setDebitKind(event.target.value as HawalaPartyKind)
                      setDebitId('')
                    }}
                    aria-label="Debit (From) kind"
                  >
                    {HAWALA_PARTY_KINDS.filter((kind) => kind !== 'AGENT').map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabel(kind)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Debit (From) party" required>
                  <Select value={debitId} onChange={(event) => setDebitId(event.target.value)} aria-label="Debit (From) party">
                    <option value="">Select</option>
                    {optionsFor(debitKind).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Credit (To) kind" required>
                  <Select
                    value={creditKind}
                    onChange={(event) => {
                      setCreditKind(event.target.value as HawalaPartyKind)
                      setCreditId('')
                    }}
                    aria-label="Credit (To) kind"
                  >
                    {HAWALA_PARTY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabel(kind)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Credit (To) party" required>
                  <Select value={creditId} onChange={(event) => setCreditId(event.target.value)} aria-label="Credit (To) party">
                    <option value="">Select</option>
                    {optionsFor(creditKind).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormGrid>
            </FormSection>
            <FormSection title="Balances">
              <FormGrid>
                <FormField label="From current">
                  <p className="text-sm"><MoneyDisplay amountMinor={debitBal?.balance_minor} /></p>
                </FormField>
                <FormField label="From after">
                  <p className="text-sm"><MoneyDisplay amountMinor={debitEffective} /></p>
                </FormField>
                <FormField label="To current">
                  <p className="text-sm"><MoneyDisplay amountMinor={creditBal?.balance_minor} /></p>
                </FormField>
                <FormField label="To after">
                  <p className="text-sm"><MoneyDisplay amountMinor={creditEffective} /></p>
                </FormField>
              </FormGrid>
              {debitBal && creditBal && amountMinor > 0 ? (
                <p className="mt-1 text-xs" data-testid="hawala-outcome">
                  <strong>{debitBal.label}</strong> gives <MoneyDisplay amountMinor={amountMinor} /> to{' '}
                  <strong>{creditBal.label}</strong>. After:{' '}
                  <PositionText label={debitBal.label} amountMinor={debitEffective} /> ·{' '}
                  <PositionText label={creditBal.label} amountMinor={creditEffective} />
                </p>
              ) : null}
            </FormSection>
            <FormSection title="Amount">
              <FormGrid>
                <FormField label="Amount" required>
                  <MoneyInput id="hawala-amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
                </FormField>
                <FormField label="Remark">
                  <Input value={remark} onChange={(event) => setRemark(event.target.value)} aria-label="Remark" />
                </FormField>
                <FormField label="UTR (optional)">
                  <Input value={utr} onChange={(event) => setUtr(event.target.value)} aria-label="UTR" />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      <FilterBar
        onApply={() => {
          setPage(1)
          void loadHistory({ page: 1 })
        }}
        onClear={() => {
          setQ('')
          setDateFrom('')
          setDateTo('')
          setStatusFilter('')
          setFilterDebitKind('')
          setFilterCreditKind('')
          setFilterDebitId('')
          setFilterCreditId('')
          setPage(1)
          void loadHistory({ page: 1, clearAll: true })
        }}
        onReload={() => void loadHistory()}
      >
        <FormField label="Start Date">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Start Date"
          />
        </FormField>
        <FormField label="End Date">
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="End Date"
          />
        </FormField>
        {portalMode ? null : (
          <>
            <FormField label="Status">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as HawalaStatus | '')}
                aria-label="Status"
              >
                <option value="">All</option>
                {HAWALA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Debit (From) type">
              <Select
                value={filterDebitKind}
                onChange={(event) => {
                  setFilterDebitKind(event.target.value as HawalaPartyKind | '')
                  setFilterDebitId('')
                }}
                aria-label="Debit (From) type"
              >
                <option value="">All</option>
                {HAWALA_PARTY_KINDS.filter((kind) => kind !== 'AGENT').map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Debit (From) party">
              <Select
                value={filterDebitId}
                onChange={(event) => setFilterDebitId(event.target.value)}
                aria-label="Debit (From) party"
                disabled={!filterDebitKind}
              >
                <option value="">All</option>
                {filterDebitKind
                  ? optionsFor(filterDebitKind).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))
                  : null}
              </Select>
            </FormField>
            <FormField label="Credit (To) type">
              <Select
                value={filterCreditKind}
                onChange={(event) => {
                  setFilterCreditKind(event.target.value as HawalaPartyKind | '')
                  setFilterCreditId('')
                }}
                aria-label="Credit (To) type"
              >
                <option value="">All</option>
                {HAWALA_PARTY_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Credit (To) party">
              <Select
                value={filterCreditId}
                onChange={(event) => setFilterCreditId(event.target.value)}
                aria-label="Credit (To) party"
                disabled={!filterCreditKind}
              >
                <option value="">All</option>
                {filterCreditKind
                  ? optionsFor(filterCreditKind).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))
                  : null}
              </Select>
            </FormField>
            <FormField label="Reference">
              <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Reference" aria-label="Reference" />
            </FormField>
          </>
        )}
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'HAWALA', 'can_export')}
            onExport={() => {
              const query = listQueryParams()
              query.delete('page')
              query.delete('page_size')
              void downloadExport(
                `/api/v1/hawala/export?${query}`,
                portalMode ? 'inter-transfer.csv' : 'hawala.csv',
                accessToken!,
              )
            }}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={
          portalMode
            ? [
                { key: 'created', heading: 'DATE & TIME' },
                { key: 'ref', heading: 'TRANSACTION NO.' },
                { key: 'type', heading: 'TRANSACTION TYPE' },
                { key: 'amount', heading: 'AMOUNT' },
                { key: 'remark', heading: 'REMARK' },
                { key: 'utr', heading: 'UTR' },
              ]
            : [
                { key: 'created', heading: 'DATE & TIME' },
                { key: 'ref', heading: 'Gateway Ref. No' },
                { key: 'debit', heading: 'DEBIT (FROM)' },
                { key: 'credit', heading: 'CREDIT (TO)' },
                { key: 'amount', heading: 'AMOUNT' },
                { key: 'remark', heading: 'REMARK' },
                { key: 'utr', heading: 'UTR' },
                { key: 'status', heading: 'STATUS' },
                { key: 'actions', heading: 'ACTION' },
              ]
        }
        rows={rows.map((row) => {
          if (portalMode) {
            const direction = perspectiveDirection(row)
            return {
              _rowKey: row.id,
              created: formatDateTimeIst(row.created_at),
              ref: row.reference,
              type: (
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                    direction === 'DEBIT'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {direction === 'DEBIT' ? 'DEBIT (FROM)' : 'CREDIT (TO)'}
                </span>
              ),
              amount: <MoneyDisplay amountMinor={row.amount_minor} />,
              remark: row.remark ?? '—',
              utr: row.utrs.join(', ') || '—',
            }
          }
          return {
            _rowKey: row.id,
            created: formatDateTimeIst(row.created_at),
            ref: row.reference,
            debit:
              row.direction_rule === 'LEGACY' ? (
                <span title="Posted before Debit = From. Payer balance moved down.">
                  {kindLabel(row.debit.kind)}: {row.debit.label}{' '}
                  <span className="text-[10px] font-semibold text-amber-700">LEGACY</span>
                </span>
              ) : (
                `${kindLabel(row.debit.kind)}: ${row.debit.label}`
              ),
            credit: `${kindLabel(row.credit.kind)}: ${row.credit.label}`,
            amount: <MoneyDisplay amountMinor={row.amount_minor} />,
            remark: row.remark ?? '—',
            utr: row.utrs.join(', ') || '—',
            status: <StatusBadge status={row.status} />,
            actions:
              canApprove && row.status === 'PENDING_APPROVAL' ? (
                <span className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => setConfirm({ id: row.id, action: 'approve' })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirm({ id: row.id, action: 'reject' })}
                  >
                    Reject
                  </Button>
                </span>
              ) : (
                '—'
              ),
          }
        })}
        empty={
          <EmptyState
            message={
              portalMode
                ? 'No Inter Transfer rows yet.'
                : 'No Hawala yet — submit a Hawala transfer to see history here.'
            }
          />
        }
        pagination={{ page, page_size: 25, total }}
        onPage={setPage}
      />
      {confirm ? (
        <ConfirmDialog
          title={confirm.action === 'approve' ? 'Approve this Hawala?' : 'Reject this Hawala?'}
          subtitle={
            confirm.action === 'approve'
              ? `${
                  confirmRow
                    ? `${confirmRow.debit.label} gives ${fromMinor(BigInt(confirmRow.amount_minor))} to ${confirmRow.credit.label}. `
                    : ''
                }Money posts when you confirm.`
              : 'This Hawala will stay rejected.'
          }
          confirmLabel={confirm.action === 'approve' ? 'Approve' : 'Reject'}
          variant={confirm.action === 'approve' ? 'primary' : 'danger'}
          loading={acting}
          onConfirm={() => void handleDecide()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </AppShell>
  )
}
