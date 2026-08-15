'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { BankAccountListItem, TransferType } from '@quickerpay/shared-types'
import { TRANSFER_TYPES } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
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
      <PageHeader title="Create Inter-Transfer" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel="Create transfer" onSubmit={() => void handleSubmit()}>
        <FormSection title="Transfer Details" description="Select the accounts and specify the amount.">
          <FormGrid>
            <div className="md:col-span-2">
              <FormField label="Transfer type">
                <div className="flex flex-wrap items-center gap-4 py-2">
                  {TRANSFER_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="radio"
                        name="transfer_type"
                        checked={transferType === type}
                        onChange={() => setTransferType(type)}
                      />
                      {type.replaceAll('_', ' ')}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            <FormField label="Source account" required>
              <Select required value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Select</option>
                {banks.map((row) => (
                  <option key={row.id} value={row.id}>
                    {bankLabel(row)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Destination account" required>
              <Select required value={destId} onChange={(e) => setDestId(e.target.value)}>
                <option value="">Select</option>
                {banks.map((row) => (
                  <option key={row.id} value={row.id}>
                    {bankLabel(row)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Amount" required>
              <MoneyInput id="amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Additional Information" description="Optional reference and remark.">
          <FormGrid>
            <FormField label="Reference">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </FormField>
            <FormField label="Remark">
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
