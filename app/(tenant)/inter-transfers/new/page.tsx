'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
import { toast } from 'sonner'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { hasMenu, useSession } from '@/lib/session'

function bankLabel(row: BankAccountListItem) {
  return `${row.owner_display_name} - ${row.bank_name ?? row.label} ${row.account_number_masked ?? ''}`
}

function sourceBanks(rows: BankAccountListItem[], transferType: TransferType) {
  if (transferType === 'ADMIN_TO_ADMIN' || transferType === 'ADMIN_TO_SUPER_ADMIN') {
    return rows.filter((row) => row.owner_role === 'ADMIN')
  }
  if (transferType === 'SUPER_ADMIN_TO_ADMIN') {
    return rows.filter((row) => row.owner_role === 'SUPER_ADMIN')
  }
  return rows
}

function destinationBanks(rows: BankAccountListItem[], transferType: TransferType, source: BankAccountListItem | undefined) {
  if (transferType === 'ADMIN_TO_ADMIN') {
    return rows.filter(
      (row) => row.owner_role === 'ADMIN' && (!source || row.owner_user_id !== source.owner_user_id),
    )
  }
  if (transferType === 'ADMIN_TO_SUPER_ADMIN') {
    return rows.filter((row) => row.owner_role === 'SUPER_ADMIN')
  }
  if (transferType === 'SUPER_ADMIN_TO_ADMIN') {
    return rows.filter((row) => row.owner_role === 'ADMIN')
  }
  return rows.filter((row) => source && row.owner_user_id === source.owner_user_id && row.id !== source.id)
}

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
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'SUPER_ADMIN' || !hasMenu(menus, 'INTER_TRANSFER', 'can_create')) return
    if (!accessToken) return
    void apiListRequest<BankAccountListItem>('/api/v1/bank-accounts?page_size=100&status=ACTIVE', { token: accessToken })
      .then((result) => setBanks(result.items))
      .catch((caught) => {
        setError(caught instanceof ApiClientError ? caught.message : 'Could not load bank accounts')
      })
  }, [ready, user, menus, accessToken, router])

  const sourceOptions = useMemo(() => sourceBanks(banks, transferType), [banks, transferType])
  const source = sourceOptions.find((row) => row.id === sourceId)
  const destOptions = useMemo(
    () => destinationBanks(banks, transferType, source),
    [banks, transferType, source],
  )

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading</p>
  if (!user) return null
  if (user.role !== 'SUPER_ADMIN' || !hasMenu(menus, 'INTER_TRANSFER', 'can_create')) {
    return <ForbiddenPage permission="INTER_TRANSFER.can_create" />
  }

  const handleTransferTypeChange = (next: TransferType) => {
    setTransferType(next)
    setSourceId('')
    setDestId('')
  }

  const handleSourceChange = (nextId: string) => {
    setSourceId(nextId)
    const nextSource = sourceOptions.find((row) => row.id === nextId)
    const allowedDest = destinationBanks(banks, transferType, nextSource)
    if (!allowedDest.some((row) => row.id === destId)) setDestId('')
  }

  const handleSubmit = async () => {
    if (!accessToken || submitting) return
    setError(null)
    setSubmitting(true)
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
      toast.success('Transfer created')
      router.push('/inter-transfers')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Create transfer" role={user.role} menus={menus}>
      <PageHeader title="Create Inter-Transfer" />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel={submitting ? 'Creating…' : 'Create transfer'} onSubmit={() => void handleSubmit()}>
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
                        onChange={() => handleTransferTypeChange(type)}
                      />
                      {type.replaceAll('_', ' ')}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            <FormField label="Source account" required>
              <Select required value={sourceId} onChange={(event) => handleSourceChange(event.target.value)} aria-label="Source account">
                <option value="">Select</option>
                {sourceOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {bankLabel(row)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Destination account" required>
              <Select required value={destId} onChange={(event) => setDestId(event.target.value)} aria-label="Destination account">
                <option value="">Select</option>
                {destOptions.map((row) => (
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
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </FormField>
            <FormField label="Remark">
              <Input value={remark} onChange={(event) => setRemark(event.target.value)} />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    </AppShell>
  )
}
