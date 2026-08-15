'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/FilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { AppShell } from '@/components/layout/AppShell'

interface MockRow {
  id: string
  date: string
  vpa: string
  name: string
  utr: string
  type: string
  amount: string
}

const STORAGE_KEY = 'quickerpay-mock-gpay-rows'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatGpayDate(at: Date): string {
  const hours12 = at.getHours() % 12 || 12
  const minutes = String(at.getMinutes()).padStart(2, '0')
  const ampm = at.getHours() >= 12 ? 'PM' : 'AM'
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}, ${hours12}:${minutes} ${ampm}`
}

function formatRupees(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function nextUtr(): string {
  return `${Date.now()}${Math.floor(Math.random() * 90 + 10)}`.slice(-12)
}

function seedRows(): MockRow[] {
  const now = new Date()
  return [
    {
      id: 'seed-1',
      date: formatGpayDate(now),
      vpa: 'merchant@okaxis',
      name: 'Incoming',
      utr: nextUtr(),
      type: 'CREDIT',
      amount: formatRupees(2000),
    },
  ]
}

function readStoredRows(): MockRow[] {
  if (typeof window === 'undefined') return seedRows()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedRows()
    const parsed = JSON.parse(raw) as MockRow[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedRows()
    return parsed
  } catch {
    return seedRows()
  }
}

export default function MockGpayPage() {
  const [rows, setRows] = useState<MockRow[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [vpa, setVpa] = useState('merchant@okaxis')
  const [amountRupees, setAmountRupees] = useState('1250.50')
  const [customUtr, setCustomUtr] = useState('')

  useEffect(() => {
    setRows(readStoredRows())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  }, [hydrated, rows])

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, currentPage, pageSize])

  const pushRow = useCallback((row: MockRow) => {
    setRows((current) => [row, ...current])
    setPage(1)
  }, [])

  const handleSimulate = () => {
    const rupees = Number.parseFloat(amountRupees.replace(/,/g, ''))
    const amount = Number.isFinite(rupees) && rupees > 0 ? formatRupees(rupees) : formatRupees(1250.5)
    const utr = customUtr.replace(/\D/g, '').slice(0, 32) || nextUtr()
    pushRow({
      id: utr,
      date: formatGpayDate(new Date()),
      vpa: vpa.trim() || 'merchant@okaxis',
      name: 'Incoming',
      utr,
      type: 'CREDIT',
      amount,
    })
    setCustomUtr('')
  }

  const handleMalformed = (kind: 'date' | 'utr' | 'amount') => {
    const utr = nextUtr()
    pushRow({
      id: `${utr}-${kind}`,
      date: kind === 'date' ? 'not-a-gpay-date' : formatGpayDate(new Date()),
      vpa: 'merchant@okaxis',
      name: 'Incoming',
      utr: kind === 'utr' ? 'ABC' : utr,
      type: 'CREDIT',
      amount: kind === 'amount' ? '₹0.00' : formatRupees(100),
    })
  }

  const handleClear = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setRows(seedRows())
    setPage(1)
  }

  const handlePageSize = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  if (!hydrated) return <main className="p-4 text-sm text-zinc-600">Loading mock Google Pay</main>

  return (
    <AppShell title="Google Pay for Business (mock)" role="ADMIN" menus={[]}>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--qp-primary)' }}>Local test fixture — not Google Pay</p>
        <p className="mt-1 text-sm text-zinc-600">
          Same table the extension scrapes: column 0 date, 1 VPA, 3 UTR, 5 amount. Open
          {' '}
          <a className="underline" href="http://localhost:3000/mock/gpay">http://localhost:3000/mock/gpay</a>
          , enrol in the side panel, leave Filter UTR blank, then simulate a payment.
        </p>
      </header>

      <section className="mb-4 rounded-xl border p-4 shadow-sm flex flex-wrap items-end gap-2" style={{ backgroundColor: 'var(--qp-card)', borderColor: 'var(--qp-border)' }}>
        <FormField label="VPA">
          <Input value={vpa} onChange={(event) => setVpa(event.target.value)} aria-label="Mock VPA" />
        </FormField>
        <FormField label="Amount">
          <Input value={amountRupees} onChange={(event) => setAmountRupees(event.target.value)} aria-label="Mock amount" />
        </FormField>
        <FormField label="UTR (optional)">
          <Input value={customUtr} onChange={(event) => setCustomUtr(event.target.value)} aria-label="Mock UTR" />
        </FormField>
        <div className="flex flex-wrap items-end gap-2 pt-1 ml-auto">
          <PrimaryButton onClick={handleSimulate}>Simulate</PrimaryButton>
          <button type="button" className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm font-medium shadow-sm hover:bg-zinc-50" onClick={() => handleMalformed('date')}>Bad date</button>
          <button type="button" className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm font-medium shadow-sm hover:bg-zinc-50" onClick={() => handleMalformed('utr')}>Bad UTR</button>
          <button type="button" className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm font-medium shadow-sm hover:bg-zinc-50" onClick={() => handleMalformed('amount')}>Zero amt</button>
          <button type="button" className="h-9 px-3 rounded-md border text-red-600 border-red-200 bg-red-50 text-sm font-medium shadow-sm hover:bg-red-100" onClick={handleClear}>Reset table</button>
        </div>
      </section>

      <DataTable
        columns={[
          { key: 'date', heading: 'Date' },
          { key: 'vpa', heading: 'VPA' },
          { key: 'name', heading: 'Name' },
          { key: 'utr', heading: 'UTR' },
          { key: 'type', heading: 'Type' },
          { key: 'amount', heading: 'Amount' },
        ]}
        rows={pageRows.map((row) => ({
          date: row.date,
          vpa: row.vpa,
          name: row.name,
          utr: row.utr,
          type: row.type,
          amount: row.amount,
        }))}
        empty={<div className="p-8 text-center text-zinc-500">No mock transactions</div>}
        pagination={{
          page: currentPage,
          page_size: pageSize,
          total: rows.length,
        }}
        onPage={setPage}
        onPageSize={handlePageSize}
      />
    </AppShell>
  )
}
