'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

  const handlePageSize = (value: string) => {
    setPageSize(Number.parseInt(value, 10) || 50)
    setPage(1)
  }

  if (!hydrated) return <main className="p-4 text-sm text-zinc-600">Loading mock Google Pay</main>

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-sm text-zinc-900">
      <header className="mb-3 border-b border-zinc-200 pb-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Local test fixture — not Google Pay</p>
        <h1 className="text-base font-semibold">Google Pay for Business (mock)</h1>
        <p className="text-xs text-zinc-600">
          Same table the extension scrapes: column 0 date, 1 VPA, 3 UTR, 5 amount. Enrol in the popup, leave Filter UTR blank, then simulate a payment. Rows survive the extension&apos;s 30s reload.
        </p>
      </header>

      <section className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          VPA
          <input
            className="ml-1 h-7 rounded border border-zinc-300 px-1"
            value={vpa}
            onChange={(event) => setVpa(event.target.value)}
            aria-label="Mock VPA"
          />
        </label>
        <label className="text-xs">
          Amount
          <input
            className="ml-1 h-7 w-24 rounded border border-zinc-300 px-1"
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
            aria-label="Mock amount"
          />
        </label>
        <label className="text-xs">
          UTR (optional)
          <input
            className="ml-1 h-7 w-32 rounded border border-zinc-300 px-1"
            value={customUtr}
            onChange={(event) => setCustomUtr(event.target.value)}
            aria-label="Mock UTR"
          />
        </label>
        <button type="button" className="h-7 rounded bg-zinc-900 px-2 text-xs text-white" onClick={handleSimulate}>
          Simulate incoming payment
        </button>
        <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => handleMalformed('date')}>
          Add bad date
        </button>
        <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => handleMalformed('utr')}>
          Add bad UTR
        </button>
        <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={() => handleMalformed('amount')}>
          Add zero amount
        </button>
        <button type="button" className="h-7 rounded border border-zinc-300 px-2 text-xs" onClick={handleClear}>
          Reset table
        </button>
      </section>

      <table className="min-w-full border border-zinc-200 bg-white text-left text-xs">
        <thead className="bg-zinc-50">
          <tr>
            <th className="border-b px-2 py-1">Date</th>
            <th className="border-b px-2 py-1">VPA</th>
            <th className="border-b px-2 py-1">Name</th>
            <th className="border-b px-2 py-1">UTR</th>
            <th className="border-b px-2 py-1">Type</th>
            <th className="border-b px-2 py-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => (
            <tr key={row.id}>
              <td className="border-b px-2 py-1">{row.date}</td>
              <td className="border-b px-2 py-1">{row.vpa}</td>
              <td className="border-b px-2 py-1">{row.name}</td>
              <td className="border-b px-2 py-1">{row.utr}</td>
              <td className="border-b px-2 py-1">{row.type}</td>
              <td className="border-b px-2 py-1">{row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <label>
          Rows per page
          <select
            className="ml-1 h-7 rounded border border-zinc-300"
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(event) => handlePageSize(event.target.value)}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
        <span>
          {rows.length === 0 ? '0' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rows.length)}`} of {rows.length}
        </span>
        <button
          type="button"
          className="h-7 rounded border border-zinc-300 px-2 disabled:opacity-40"
          aria-label="First page"
          disabled={currentPage <= 1}
          onClick={() => setPage(1)}
        >
          First
        </button>
        <button
          type="button"
          className="h-7 rounded border border-zinc-300 px-2 disabled:opacity-40"
          aria-label="Next page"
          disabled={currentPage >= pageCount}
          onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
        >
          Next
        </button>
      </div>
    </main>
  )
}
