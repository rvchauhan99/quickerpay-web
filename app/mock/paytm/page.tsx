'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/FilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { PrimaryButton } from '@/components/ui/PageHeader'
import { AppShell } from '@/components/layout/AppShell'

interface MockOrder {
  bizOrderId: string
  orderStatus: string
  orderCompletedTime: string
  payMoneyAmount: { currency: string; value: string }
  additionalInfo?: { virtualPaymentAddr?: string; customerName?: string }
}

const STORAGE_KEY = 'quickerpay-mock-paytm-orders'

function nextTxnId(): string {
  // 35-digit Paytm-style Transaction ID
  const stamp = Date.now().toString()
  const pad = `${stamp}${Math.floor(Math.random() * 1e12)}`.replace(/\D/g, '')
  return `2026${pad}`.slice(0, 35).padEnd(35, '0')
}

function seedOrders(): MockOrder[] {
  const now = new Date().toISOString()
  return [
    {
      bizOrderId: nextTxnId(),
      orderStatus: 'SUCCESS',
      orderCompletedTime: now,
      payMoneyAmount: { currency: 'INR', value: '200000' },
      additionalInfo: { virtualPaymentAddr: 'payer@ptyes', customerName: 'Mock Customer' },
    },
  ]
}

function readStored(): MockOrder[] {
  if (typeof window === 'undefined') return seedOrders()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedOrders()
    const parsed = JSON.parse(raw) as MockOrder[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedOrders()
    return parsed
  } catch {
    return seedOrders()
  }
}

function emitOrders(orders: MockOrder[]) {
  window.dispatchEvent(new CustomEvent('qp-paytm-orders', { detail: { orderList: orders } }))
}

export default function MockPaytmPage() {
  const [orders, setOrders] = useState<MockOrder[]>(() => seedOrders())
  const [hydrated, setHydrated] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [amountRupees, setAmountRupees] = useState('1250.50')
  const [customTxnId, setCustomTxnId] = useState('')

  useEffect(() => {
    setOrders(readStored())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
    emitOrders(orders)
  }, [hydrated, orders])

  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return orders.slice(start, start + pageSize)
  }, [orders, currentPage, pageSize])

  const pushOrder = useCallback((order: MockOrder) => {
    setOrders((current) => [order, ...current])
    setPage(1)
  }, [])

  const handleSimulate = () => {
    const rupees = Number.parseFloat(amountRupees.replace(/,/g, ''))
    const minor =
      Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : 125050
    const bizOrderId = customTxnId.replace(/\D/g, '').slice(0, 40) || nextTxnId()
    pushOrder({
      bizOrderId,
      orderStatus: 'SUCCESS',
      orderCompletedTime: new Date().toISOString(),
      payMoneyAmount: { currency: 'INR', value: String(minor) },
      additionalInfo: { virtualPaymentAddr: 'payer@ptyes', customerName: 'Mock Customer' },
    })
    setCustomTxnId('')
  }

  const handleClear = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setOrders(seedOrders())
    setPage(1)
  }

  return (
    <AppShell title="Paytm for Business (mock)" role="BANKER" menus={[]}>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--qp-primary)' }}>
          Local test fixture — not Paytm
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Emits the same shape as dashboard <code>POST /api/v3/order/list</code>: full Transaction ID
          (<code>bizOrderId</code>) and amount in paise. Open{' '}
          <a className="underline" href="http://localhost:3000/mock/paytm">
            http://localhost:3000/mock/paytm
          </a>
          , enrol the Paytm Sync side panel, then simulate a payment.
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
        <FormField label="Transaction ID (optional)">
          <Input
            value={customTxnId}
            onChange={(event) => setCustomTxnId(event.target.value)}
            aria-label="Mock Transaction ID"
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
          { key: 'txn', heading: 'TRANSACTION ID' },
          { key: 'amount', heading: 'AMOUNT' },
        ]}
        rows={pageRows.map((row) => ({
          time: row.orderCompletedTime,
          customer: row.additionalInfo?.customerName || '—',
          txn: row.bizOrderId,
          amount: `₹${(Number(row.payMoneyAmount.value) / 100).toLocaleString('en-IN')}`,
        }))}
        empty={<div className="p-8 text-center text-zinc-500">No mock transactions</div>}
        pagination={{
          page: currentPage,
          page_size: pageSize,
          total: orders.length,
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
