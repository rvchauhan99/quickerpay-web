'use client'

import { useRef, useState } from 'react'
import type { PayoutListItem } from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { DataTable, EmptyState } from '@/components/ui/FilterBar'
import { Button } from '@/components/ui/Button'
import { DocumentUpload } from '@/components/forms/DocumentUpload'
import { FormField } from '@/components/forms/FormField'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { FormShell } from '@/components/forms/FormShell'
import { Input } from '@/components/forms/Input'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { apiRequest, ApiClientError } from '@/lib/api'
import { downloadExport } from '@/lib/export'

const IFSC_FORMAT = /^[A-Z]{4}0[A-Z0-9]{6}$/
const CSV_MAX_BYTES = 1024 * 1024

interface RowError {
  row: number
  field: string
  message: string
}

function rowErrorsOf(caught: unknown): RowError[] {
  if (!(caught instanceof ApiClientError)) return []
  const rows = caught.details?.rows
  if (!Array.isArray(rows)) return []
  return rows.filter(
    (item): item is RowError =>
      typeof item === 'object' && item !== null && typeof (item as RowError).row === 'number',
  )
}

/**
 * Exchange Master withdrawal entry: one bank-transfer withdrawal, or a CSV of them.
 * The server checks every IFSC against the real branch list and creates nothing when any
 * row is bad; routing to a Banker or the Super Admin queue happens server-side.
 */
export function MerchantWithdrawalEntry({
  mode,
  accessToken,
  onClose,
  onCreated,
}: {
  mode: 'manual' | 'csv'
  accessToken: string
  onClose: () => void
  onCreated: () => Promise<void> | void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<RowError[]>([])
  /** One Idempotency-Key for this modal open so a double-click cannot mint two withdrawals. */
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [account, setAccount] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [file, setFile] = useState<File | null>(null)

  const resetErrors = () => {
    setBanner(null)
    setFieldErrors({})
    setRowErrors([])
  }

  const submitManual = async () => {
    if (submitting) return
    resetErrors()
    const local: Record<string, string> = {}
    if (!beneficiaryName.trim()) local.beneficiary_name = 'Required'
    if (!/^\d{6,18}$/.test(account.trim())) local.beneficiary_account = 'Account number must be 6 to 18 digits'
    if (!IFSC_FORMAT.test(ifsc.trim())) local.beneficiary_ifsc = 'An IFSC is 11 characters, fifth is zero'
    if (amountMinor <= 0) local.amount_minor = 'Enter an amount'
    if (Object.keys(local).length > 0) {
      setFieldErrors(local)
      return
    }
    setSubmitting(true)
    try {
      await apiRequest<PayoutListItem>('/api/v1/payout/merchant', {
        method: 'POST',
        token: accessToken,
        body: {
          beneficiary_name: beneficiaryName.trim(),
          beneficiary_account: account.trim(),
          beneficiary_ifsc: ifsc.trim(),
          amount_minor: amountMinor,
        },
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
      })
      toast.success('Withdrawal created')
      await onCreated()
      onClose()
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setBanner(caught.displayMessage())
        setFieldErrors(caught.fieldErrors())
      } else {
        setBanner('Could not create the withdrawal')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitCsv = async () => {
    if (submitting) return
    resetErrors()
    if (!file) {
      setFieldErrors({ file: 'Choose a CSV file' })
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const result = await apiRequest<{ created_count: number }>('/api/v1/payout/merchant/bulk', {
        method: 'POST',
        token: accessToken,
        body: form,
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
      })
      toast.success(`${result.created_count} withdrawal${result.created_count === 1 ? '' : 's'} created`)
      await onCreated()
      onClose()
    } catch (caught) {
      const rows = rowErrorsOf(caught)
      setRowErrors(rows)
      setBanner(caught instanceof ApiClientError ? caught.message : 'Could not upload the file')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'manual') {
    return (
      <FormShell
        title="New Withdrawal"
        submitLabel={submitting ? 'Creating…' : 'Create'}
        loading={submitting}
        error={banner}
        onCancel={onClose}
        onSubmit={() => void submitManual()}
      >
        <FormSection title="Beneficiary bank account" description="Bank transfer only. The IFSC must be a real branch.">
          <FormGrid>
            <FormField label="Beneficiary name" required error={fieldErrors.beneficiary_name}>
              <Input
                value={beneficiaryName}
                onChange={(event) => setBeneficiaryName(event.target.value)}
                aria-label="Beneficiary name"
              />
            </FormField>
            <FormField label="Account number" required error={fieldErrors.beneficiary_account}>
              <Input
                value={account}
                inputMode="numeric"
                onChange={(event) => setAccount(event.target.value.replace(/\s/g, ''))}
                aria-label="Account number"
              />
            </FormField>
            <FormField label="IFSC" required error={fieldErrors.beneficiary_ifsc}>
              <Input
                value={ifsc}
                maxLength={11}
                onChange={(event) => setIfsc(event.target.value.toUpperCase().replace(/\s/g, ''))}
                aria-label="IFSC"
              />
            </FormField>
            <FormField label="Amount" required error={fieldErrors.amount_minor}>
              <MoneyInput id="merchant-withdrawal-amount" valueMinor={amountMinor} onChangeMinor={setAmountMinor} />
            </FormField>
          </FormGrid>
        </FormSection>
      </FormShell>
    )
  }

  return (
    <FormShell
      title="Bulk Upload CSV"
      submitLabel={submitting ? 'Uploading…' : 'Upload'}
      loading={submitting}
      error={banner}
      onCancel={onClose}
      onSubmit={() => void submitCsv()}
    >
      <FormSection
        title="Withdrawals file"
        description="Columns: beneficiary_name, account_number, ifsc, amount (rupees). Order IDs are generated automatically. Up to 500 rows. If any row is wrong, nothing is created."
      >
        <div className="flex flex-col gap-2">
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadExport('/api/v1/payout/merchant/template.csv', accessToken, 'withdrawals-template.csv')}
            >
              Download template
            </Button>
          </div>
          <DocumentUpload
            value={file}
            onChange={(next) => {
              setFile(next)
              resetErrors()
            }}
            accept=".csv,text/csv"
            maxBytes={CSV_MAX_BYTES}
            allowCamera={false}
            error={fieldErrors.file ?? null}
            aria-label="Withdrawals CSV"
          />
        </div>
      </FormSection>
      {rowErrors.length > 0 ? (
        <FormSection title="Fix these rows" description="Row numbers match the spreadsheet; the header is row 1.">
          <DataTable
            columns={[
              { key: 'row', heading: 'ROW' },
              { key: 'field', heading: 'COLUMN' },
              { key: 'message', heading: 'PROBLEM' },
            ]}
            rows={rowErrors.map((error, index) => ({
              _rowKey: `${error.row}-${error.field}-${index}`,
              row: String(error.row),
              field: error.field,
              message: error.message,
            }))}
            empty={<EmptyState message="No problems found" />}
          />
        </FormSection>
      ) : null}
    </FormShell>
  )
}
