'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { HawalaCounterparty, HawalaPartyKind } from '@quickerpay/shared-types'
import { fromMinor } from '@quickerpay/money'
import { toast } from 'sonner'
import { Input } from '@/components/forms/Input'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { SearchableSelect, type SearchableOption } from '@/components/forms/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiRequest, ApiClientError } from '@/lib/api'
import { MoneyDisplay } from '@/lib/money'

type Side = 'DEBIT' | 'CREDIT'

interface CounterpartyOption extends SearchableOption {
  party: HawalaCounterparty
}

interface SideBalance {
  balance_minor: number
  label: string
}

const KIND_GROUP: Record<HawalaPartyKind, string> = {
  PARTY: 'Party',
  MERCHANT: 'Exchange Master',
  BANKER: 'Banker',
  AGENT: 'Agent',
}
const GROUP_ORDER = ['Party', 'Exchange Master', 'Banker', 'Agent']

function toOption(party: HawalaCounterparty): CounterpartyOption {
  const name = party.label && party.label !== party.code ? `${party.code} — ${party.label}` : party.code
  return { key: `${party.kind}:${party.id}`, label: name, group: KIND_GROUP[party.kind], party }
}

/** Positive = we owe that side; negative = that side owes us. */
function PositionText({ label, amountMinor }: { label: string; amountMinor: number }) {
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

/* ─── HawalaEntryForm ────────────────────────────────────────────────────────
   Hawala Transaction card: Select | Current Balance | Effective Balance.
   The picked code decides the kind. Debit (From) gives: effective = current +
   amount. Credit (To) receives: effective = current − amount.
──────────────────────────────────────────────────────────────────────────── */
export function HawalaEntryForm({
  accessToken,
  onSubmitted,
}: {
  accessToken: string
  onSubmitted: () => void | Promise<void>
}) {
  const [debit, setDebit] = useState<CounterpartyOption | null>(null)
  const [credit, setCredit] = useState<CounterpartyOption | null>(null)
  const [debitBal, setDebitBal] = useState<SideBalance | null>(null)
  const [creditBal, setCreditBal] = useState<SideBalance | null>(null)
  const [amountMinor, setAmountMinor] = useState(0)
  const [remark, setRemark] = useState('')
  const [utr, setUtr] = useState('')
  const [resetSeq, setResetSeq] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (side: Side, q: string): Promise<CounterpartyOption[]> => {
      const query = new URLSearchParams({ side })
      if (q) query.set('q', q)
      const result = await apiRequest<{ items: HawalaCounterparty[] }>(
        `/api/v1/hawala/counterparties?${query}`,
        { token: accessToken },
      )
      return result.items.map(toOption)
    },
    [accessToken],
  )
  const searchDebit = useCallback((q: string) => search('DEBIT', q), [search])
  const searchCredit = useCallback((q: string) => search('CREDIT', q), [search])

  const loadBalance = useCallback(
    async (option: CounterpartyOption | null, set: (value: SideBalance | null) => void) => {
      if (!option) {
        set(null)
        return
      }
      try {
        set(
          await apiRequest<SideBalance>(
            `/api/v1/hawala/balance?kind=${option.party.kind}&id=${option.party.id}`,
            { token: accessToken },
          ),
        )
      } catch {
        set(null)
      }
    },
    [accessToken],
  )

  useEffect(() => {
    void loadBalance(debit, setDebitBal)
  }, [debit, loadBalance])
  useEffect(() => {
    void loadBalance(credit, setCreditBal)
  }, [credit, loadBalance])

  const sameSide = debit !== null && credit !== null && debit.key === credit.key
  const debitCurrent = debitBal?.balance_minor ?? 0
  const creditCurrent = creditBal?.balance_minor ?? 0
  const debitEffective = debitBal ? debitCurrent + amountMinor : 0
  const creditEffective = creditBal ? creditCurrent - amountMinor : 0
  const debitName = debitBal?.label ?? debit?.party.label ?? ''
  const creditName = creditBal?.label ?? credit?.party.label ?? ''

  const validate = (): string | null => {
    if (!debit) return 'Select the Debit (From) side'
    if (!credit) return 'Select the Credit (To) side'
    if (sameSide) return 'Debit and Credit must be different'
    if (amountMinor <= 0) return 'Enter an amount greater than zero'
    return null
  }

  const submit = async () => {
    if (!debit || !credit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/api/v1/hawala', {
        method: 'POST',
        token: accessToken,
        headers: { 'Idempotency-Key': `haw-ui-${Date.now()}` },
        body: {
          debit: { kind: debit.party.kind, id: debit.party.id },
          credit: { kind: credit.party.kind, id: credit.party.id },
          amount_minor: amountMinor,
          remark: remark.trim() || undefined,
          utr: utr.trim() || undefined,
        },
      })
      toast.success('Hawala submitted — waiting for Super Admin')
      setConfirming(false)
      setAmountMinor(0)
      setRemark('')
      setUtr('')
      setResetSeq((seq) => seq + 1)
      await Promise.all([loadBalance(debit, setDebitBal), loadBalance(credit, setCreditBal)])
      await onSubmitted()
    } catch (caught) {
      setConfirming(false)
      setError(caught instanceof ApiClientError ? caught.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mb-qp-gap" aria-label="Hawala Transaction">
      <div
        className="overflow-visible rounded-qp border"
        style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-card)' }}
      >
        <div
          className="grid grid-cols-[2fr_1fr_1fr] text-center text-xs font-semibold"
          style={{ backgroundColor: 'var(--qp-surface)', color: 'var(--qp-text-primary)' }}
        >
          <HeaderCell>Select</HeaderCell>
          <HeaderCell>Current Balance</HeaderCell>
          <HeaderCell last>Effective Balance</HeaderCell>
        </div>

        <EntryRow
          label="Debit"
          control={
            <SearchableSelect
              aria-label="Debit"
              value={debit}
              onChange={setDebit}
              onSearch={searchDebit}
              groupOrder={GROUP_ORDER}
              placeholder="Select Party / Exchange / Banker"
            />
          }
          current={<MoneyDisplay amountMinor={debitCurrent} />}
          effective={
            <span className="font-semibold text-[var(--qp-danger)]" data-testid="hawala-debit-effective">
              <MoneyDisplay amountMinor={debitEffective} />
            </span>
          }
        />
        <EntryRow
          label="Credit"
          control={
            <SearchableSelect
              aria-label="Credit"
              value={credit}
              onChange={setCredit}
              onSearch={searchCredit}
              groupOrder={GROUP_ORDER}
              placeholder="Select Party / Exchange / Banker"
            />
          }
          current={<MoneyDisplay amountMinor={creditCurrent} />}
          effective={
            <span className="font-semibold text-[var(--qp-success)]" data-testid="hawala-credit-effective">
              <MoneyDisplay amountMinor={creditEffective} />
            </span>
          }
        />
        <EntryRow
          label="Amount"
          control={
            <MoneyInput
              key={`amount-${resetSeq}`}
              id="hawala-amount"
              valueMinor={amountMinor}
              onChangeMinor={setAmountMinor}
              placeholder="Enter amount"
              live
            />
          }
        />
        <EntryRow
          label="Remark"
          control={
            <Input
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="Enter remark"
              aria-label="Remark"
            />
          }
        />
        <EntryRow
          label="UTR"
          last
          control={
            <Input
              value={utr}
              onChange={(event) => setUtr(event.target.value)}
              placeholder="Enter UTR (optional)"
              aria-label="UTR"
            />
          }
        />
      </div>

      {debitBal && creditBal && amountMinor > 0 && !sameSide ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }} data-testid="hawala-outcome">
          <strong>{debitName}</strong> gives <MoneyDisplay amountMinor={amountMinor} /> to{' '}
          <strong>{creditName}</strong>. After: <PositionText label={debitName} amountMinor={debitEffective} /> ·{' '}
          <PositionText label={creditName} amountMinor={creditEffective} />
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-[var(--qp-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button
          loading={submitting}
          onClick={() => {
            const problem = validate()
            if (problem) {
              setError(problem)
              return
            }
            setError(null)
            setConfirming(true)
          }}
        >
          Submit Hawala
        </Button>
      </div>

      {confirming && debit && credit ? (
        <ConfirmDialog
          title="Submit this Hawala?"
          subtitle={`${debitName} gives ${fromMinor(BigInt(amountMinor))} to ${creditName}. Money moves only after Super Admin Approve.`}
          confirmLabel="Submit Hawala"
          variant="primary"
          loading={submitting}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </section>
  )
}

function HeaderCell({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return (
    <div
      className={['border-b px-3 py-2', last ? '' : 'border-r'].join(' ')}
      style={{ borderColor: 'var(--qp-border)' }}
    >
      {children}
    </div>
  )
}

function EntryRow({
  label,
  control,
  current,
  effective,
  last = false,
}: {
  label: string
  control: ReactNode
  current?: ReactNode
  effective?: ReactNode
  last?: boolean
}) {
  const cell = ['flex items-center justify-center px-3 py-2 text-sm', last ? '' : 'border-b'].join(' ')
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr]">
      <div
        className={['border-r px-3 py-2', last ? '' : 'border-b'].join(' ')}
        style={{ borderColor: 'var(--qp-border)' }}
      >
        <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
          {label}
        </p>
        {control}
      </div>
      <div className={[cell, 'border-r'].join(' ')} style={{ borderColor: 'var(--qp-border)' }}>
        {current ?? <span style={{ color: 'var(--qp-text-muted)' }}>—</span>}
      </div>
      <div className={cell} style={{ borderColor: 'var(--qp-border)' }}>
        {effective ?? <span style={{ color: 'var(--qp-text-muted)' }}>—</span>}
      </div>
    </div>
  )
}
