'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HawalaListItem, HawalaPartyKind, MerchantListItem, PartyListItem } from '@quickerpay/shared-types'
import { HAWALA_PARTY_KINDS } from '@quickerpay/shared-types'
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
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'
import { MoneyDisplay } from '@/lib/money'
import { hasMenu, useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

interface DirectoryUser {
  id: string
  username: string
  display_name: string
  role: string
}

interface SideBalance {
  balance_minor: number
  label: string
}

export default function HawalaPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [rows, setRows] = useState<HawalaListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

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

  const canCreate = user?.role === 'SUPER_ADMIN' && hasMenu(menus, 'HAWALA', 'can_create')

  const loadHistory = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    const query = new URLSearchParams({ page: String(page), page_size: '25' })
    if (q) query.set('q', q)
    try {
      const result = await apiListRequest<HawalaListItem>(`/api/v1/hawala?${query}`, { token: accessToken })
      setRows(result.items)
      setTotal(result.pagination.total)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load Hawala')
    }
  }, [accessToken, page, q])

  const loadDirectories = useCallback(async () => {
    if (!accessToken || !canCreate) return
    try {
      const [partyRes, merchantRes, userRes] = await Promise.all([
        apiListRequest<PartyListItem>('/api/v1/parties?page_size=100&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as PartyListItem[] })),
        apiListRequest<MerchantListItem>('/api/v1/merchants?page_size=100&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as MerchantListItem[] })),
        apiListRequest<DirectoryUser>('/api/v1/users?page_size=100&role=BANKER&status=ACTIVE', { token: accessToken }).catch(() => ({ items: [] as DirectoryUser[] })),
      ])
      setParties(partyRes.items)
      setMerchants(merchantRes.items)
      setBankers(userRes.items)
    } catch {
      /* directories optional for Banker view */
    }
  }, [accessToken, canCreate])

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

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (!hasMenu(menus, 'HAWALA')) return <ForbiddenPage permission="HAWALA.can_view" />

  const optionsFor = (kind: HawalaPartyKind) => {
    if (kind === 'PARTY') {
      return parties.map((row) => ({ id: row.id, label: `${row.party_code} — ${row.display_name}` }))
    }
    if (kind === 'MERCHANT') {
      return merchants.map((row) => ({ id: row.id, label: row.display_name }))
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
      toast.success('Hawala submitted')
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

  const debitEffective =
    debitBal && amountMinor > 0 ? debitBal.balance_minor - amountMinor : debitBal?.balance_minor ?? null
  const creditEffective =
    creditBal && amountMinor > 0 ? creditBal.balance_minor + amountMinor : creditBal?.balance_minor ?? null

  return (
    <AppShell title="Hawala" role={user.role} menus={menus}>
      <PageHeader title="Hawala" />
      <ErrorAlert message={error} />

      {canCreate ? (
        <div className="mb-6">
          <FormShell
            title="Submit Hawala"
            submitLabel={submitting ? 'Submitting…' : 'Submit Hawala'}
            loading={submitting}
            onSubmit={() => void handleSubmit()}
          >
            <FormSection title="Parties">
              <FormGrid>
                <FormField label="Debit kind" required>
                  <Select
                    value={debitKind}
                    onChange={(event) => {
                      setDebitKind(event.target.value as HawalaPartyKind)
                      setDebitId('')
                    }}
                    aria-label="Debit kind"
                  >
                    {HAWALA_PARTY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind === 'MERCHANT' ? 'Exchange Master' : kind === 'PARTY' ? 'Party' : 'Banker'}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Debit party" required>
                  <Select value={debitId} onChange={(event) => setDebitId(event.target.value)} aria-label="Debit party">
                    <option value="">Select</option>
                    {optionsFor(debitKind).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Credit kind" required>
                  <Select
                    value={creditKind}
                    onChange={(event) => {
                      setCreditKind(event.target.value as HawalaPartyKind)
                      setCreditId('')
                    }}
                    aria-label="Credit kind"
                  >
                    {HAWALA_PARTY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind === 'MERCHANT' ? 'Exchange Master' : kind === 'PARTY' ? 'Party' : 'Banker'}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Credit party" required>
                  <Select value={creditId} onChange={(event) => setCreditId(event.target.value)} aria-label="Credit party">
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
                <FormField label="Debit current">
                  <p className="text-sm"><MoneyDisplay amountMinor={debitBal?.balance_minor} /></p>
                </FormField>
                <FormField label="Debit effective">
                  <p className="text-sm"><MoneyDisplay amountMinor={debitEffective} /></p>
                </FormField>
                <FormField label="Credit current">
                  <p className="text-sm"><MoneyDisplay amountMinor={creditBal?.balance_minor} /></p>
                </FormField>
                <FormField label="Credit effective">
                  <p className="text-sm"><MoneyDisplay amountMinor={creditEffective} /></p>
                </FormField>
              </FormGrid>
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

      <FilterBar onApply={() => { setPage(1); void loadHistory() }} onClear={() => { setQ(''); setPage(1); void loadHistory() }} onReload={() => void loadHistory()}>
        <FormField label="Reference">
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Reference" aria-label="Reference" />
        </FormField>
        <div>
          <ExportButton
            disabled={rows.length === 0}
            canExport={hasMenu(menus, 'HAWALA', 'can_export')}
            onExport={() =>
              void downloadExport(
                `/api/v1/hawala/export?${new URLSearchParams({ q }).toString()}`,
                'hawala.csv',
                accessToken!,
              )
            }
          />
        </div>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'created', heading: 'DATE & TIME' },
          { key: 'ref', heading: 'Gateway Ref. No' },
          { key: 'debit', heading: 'DEBIT' },
          { key: 'credit', heading: 'CREDIT' },
          { key: 'amount', heading: 'AMOUNT' },
          { key: 'remark', heading: 'REMARK' },
          { key: 'utr', heading: 'UTR' },
          { key: 'status', heading: 'STATUS' },
        ]}
        rows={rows.map((row) => ({
          _rowKey: row.id,
          created: new Date(row.created_at).toLocaleString(),
          ref: row.reference,
          debit: `${row.debit.kind === 'MERCHANT' ? 'Exchange' : row.debit.kind}: ${row.debit.label}`,
          credit: `${row.credit.kind === 'MERCHANT' ? 'Exchange' : row.credit.kind}: ${row.credit.label}`,
          amount: <MoneyDisplay amountMinor={row.amount_minor} />,
          remark: row.remark ?? '—',
          utr: row.utrs.join(', ') || '—',
          status: <StatusBadge status={row.status} />,
        }))}
        empty={<EmptyState message="No Hawala yet — submit a Hawala transfer to see history here." />}
        pagination={{ page, page_size: 25, total }}
        onPage={setPage}
      />
    </AppShell>
  )
}
