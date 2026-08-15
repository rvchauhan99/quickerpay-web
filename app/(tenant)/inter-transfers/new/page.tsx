'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { BankAccountListItem, TransferType } from '@quickerpay/shared-types'
import { TRANSFER_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ForbiddenPage } from '@/components/ui/ForbiddenPage'
import { apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu, useSession } from '@/lib/session'

export default function NewInterTransferPage() {
  const router = useRouter()
  const { ready, user, menus, accessToken } = useSession()
  const [banks, setBanks] = useState<BankAccountListItem[]>([])
  const [transferType, setTransferType] = useState<TransferType>('ADMIN_TO_ADMIN')
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [reference, setReference] = useState('')
  const [remark, setRemark] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'SUPER_ADMIN' || !hasMenu(menus, 'INTER_TRANSFER', 'can_create')) return
    if (!accessToken) return
    void apiRequest<BankAccountListItem[]>('/api/v1/bank-accounts?page_size=100', { token: accessToken }).then(setBanks)
  }, [ready, user, menus, accessToken, router])

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (user.role !== 'SUPER_ADMIN' || !hasMenu(menus, 'INTER_TRANSFER', 'can_create')) {
    return <ForbiddenPage permission="INTER_TRANSFER.can_create" />
  }

  const handleSubmit = async () => {
    if (!accessToken) return
    setError(null)
    try {
      await apiRequest('/api/v1/inter-transfers', {
        method: 'POST',
        token: accessToken,
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: {
          transfer_type: transferType,
          source_bank_account_id: sourceId,
          destination_bank_account_id: destId,
          amount_minor: amountMinor,
          reference: reference || undefined,
          remark: remark || undefined,
        },
      })
      router.push('/inter-transfers')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create transfer')
    }
  }

  const bankLabel = (row: BankAccountListItem) =>
    `${row.owner_display_name} - ${row.bank_name ?? row.label} ${row.account_number_masked ?? ''}`

  return (
    <AppShell title="Create transfer" role={user.role} menus={menus}>
      <form
        className="max-w-lg space-y-2 text-sm"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <fieldset className="space-y-1">
          <legend className="text-xs text-zinc-600">Transfer type</legend>
          {TRANSFER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="transfer_type"
                checked={transferType === type}
                onChange={() => setTransferType(type)}
              />
              {type.replaceAll('_', ' ')}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-0.5 text-xs">
          Source account
          <select className="h-7 rounded border border-zinc-300" required value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Select</option>
            {banks.map((row) => (
              <option key={row.id} value={row.id}>
                {bankLabel(row)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Destination account
          <select className="h-7 rounded border border-zinc-300" required value={destId} onChange={(e) => setDestId(e.target.value)}>
            <option value="">Select</option>
            {banks.map((row) => (
              <option key={row.id} value={row.id}>
                {bankLabel(row)}
              </option>
            ))}
          </select>
        </label>
        <MoneyInput id="amount" label="Amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
        <label className="flex flex-col gap-0.5 text-xs">
          Reference
          <input className="h-7 rounded border border-zinc-300 px-2" value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Remark
          <input className="h-7 rounded border border-zinc-300 px-2" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </label>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <button type="submit" className="h-7 rounded bg-zinc-900 px-3 text-xs text-white">
          Create transfer
        </button>
      </form>
    </AppShell>
  )
}
