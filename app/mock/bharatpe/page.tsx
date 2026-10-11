'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/FilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { AppShell } from '@/components/layout/AppShell'

/** Shape matches BharatPe `data.transactions[]` from payments-tesseract. */
interface MockTxn {
  bankReferenceNo: string
  amount: number
  paymentTimestamp: number
  orderId?: string
  payeeIdentifier?: string
  payerName?: string
  status?: string
}

const STORAGE_KEY = 'quickerpay-mock-bharatpe-txns'

function nextUtr(): string {
  const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.replace(/\D/g, '')
  return n.slice(-12).padStart(12, '0')
}

function seedTxns(): MockTxn[] {
  return [
    {
      bankReferenceNo: nextUtr(),
      amount: 2000,
      paymentTimestamp: Date.now(),
      orderId: '---',
      payeeIdentifier: 'bharatpe2mockvpa001',
      payerName: 'Mock Customer',
      status: 'SUCCESS',
    },
  ]
}

function readStored(): MockTxn[] {
  if (typeof window === 'undefined') return seedTxns()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedTxns()
    const parsed = JSON.parse(raw) as MockTxn[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedTxns()
    return parsed.map((row) => {
      const utr = String(row.bankReferenceNo || '').replace(/\D/g, '')
      if (utr) return row
      return { ...row, bankReferenceNo: nextUtr() }
    })
  } catch {
    return seedTxns()
  }
}

function emitTxns(txns: MockTxn[]) {
  window.dispatchEvent(new CustomEvent('qp-bharatpe-txns', { detail: { transactions: txns } }))
}

export default function MockBharatPePage() {
  const [txns, setTxns] = useState<MockTxn[]>(() => seedTxns())
  const [hydrated, setHydrated] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [amountRupees, setAmountRupees] = useState('1250.50')
  const [customUtr, setCustomUtr] = useState('')

  useEffect(() => {
    setTxns(readStored())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(txns))
    emitTxns(txns)
  }, [hydrated, txns])

  const pageCount = Math.max(1, Math.ceil(txns.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return txns.slice(start, start + pageSize)
  }, [txns, currentPage, pageSize])

  const pushTxn = useCallback((txn: MockTxn) => {
    setTxns((current) => [txn, ...current])
    setPage(1)
  }, [])

  const handleSimulate = () => {
    const rupees = Number.parseFloat(amountRupees.replace(/,/g, ''))
    const amount = Number.isFinite(rupees) && rupees > 0 ? rupees : 1250.5
    const utr = customUtr.replace(/\D/g, '').slice(0, 40) || nextUtr()
    pushTxn({
      bankReferenceNo: utr,
      amount,
      paymentTimestamp: Date.now(),
      orderId: '---',
      payeeIdentifier: 'bharatpe2mockvpa001',
      payerName: 'Mock Customer',
      status: 'SUCCESS',
    })
    setCustomUtr('')
  }

  const handleClear = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setTxns(seedTxns())
    setPage(1)
  }

  return (
    <AppShell title="BharatPe Enterprise (mock)" role="BANKER" menus={[]}>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--qp-primary)' }}>
          Local test fixture — not BharatPe
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Emits list-shaped rows with <code>bankReferenceNo</code> (posted as <code>utr</code>) and
          rupee <code>amount</code> (converted to <code>amount_minor</code>). Live BharatPe Sync
          hooks <code>GET payments-tesseract…/merchant/transactions</code>. Open{' '}
          <a className="underline" href="http://localhost:3000/mock/bharatpe">
            http://localhost:3000/mock/bharatpe
          </a>
          , enrol the BharatPe Sync side panel, then simulate a payment.
        </p>
      </header>

      <section
        className="mb-4 rounded-xl border p-4 shadow-sm flex flex-wrap items-end gap-2"
        style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)' }}
      >
        <FormField label="Amount (₹)">
          <Input
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
            aria-label="Mock amount"
          />
        </FormField>
        <FormField label="UTR (optional)">
          <Input
            value={customUtr}
            onChange={(event) => setCustomUtr(event.target.value)}
            aria-label="Mock UTR"
          />
        </FormField>
        <div className="flex flex-wrap items-end gap-2 pt-1 ml-auto">
          <PrimaryButton onClick={handleSimulate}>Simulate</PrimaryButton>
          <button
            type="button"
            className="h-9 px-3 rounded-md border text-red-600 border-red-200 bg-red-50 text-sm font-medium shadow-sm hover:bg-red-100"
            onClick={handleClear}
          >
            Reset
          </button>
        </div>
      </section>

      <DataTable
        columns={[
          { key: 'time', heading: 'TIME' },
          { key: 'customer', heading: 'CUSTOMER' },
          { key: 'utr', heading: 'UTR ID' },
          { key: 'vpa', heading: 'VPA' },
          { key: 'amount', heading: 'AMOUNT' },
        ]}
        rows={pageRows.map((row) => ({
          time: new Date(row.paymentTimestamp).toISOString(),
          customer: row.payerName || '—',
          utr: row.bankReferenceNo || '—',
          vpa: row.payeeIdentifier || '—',
          amount: `₹${Number(row.amount).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        }))}
        empty={<div className="p-8 text-center text-zinc-500">No mock transactions</div>}
        pagination={{
          page: currentPage,
          page_size: pageSize,
          total: txns.length,
        }}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </AppShell>
  )
}
