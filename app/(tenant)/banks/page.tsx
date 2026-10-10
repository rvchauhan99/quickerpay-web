'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  BankMerchantLink,
  Pagination,
  PaymentMethodListItem,
  UpiAccountListItem,
  UpiStatusHistoryItem,
} from '@quickerpay/shared-types'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton } from '@/components/ui/PageHeader'
import { DataTable, FilterBar, StatusBadge, TableSkeleton, EmptyState, ExportButton } from '@/components/ui/FilterBar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Ban, Building2, CircleCheck, History, Pencil, RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormSection } from '@/components/forms/FormSection'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { FormField } from '@/components/forms/FormField'
import { FormShell } from '@/components/forms/FormShell'
import { Modal } from '@/components/ui/Modal'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { bankerLabel, merchantLabel } from '@/lib/labels'
import { canSeeMerchants } from '@/lib/merchant-visibility'
import { useBankListSync } from '@/lib/live/useBankListSync'
import { hasMenu } from '@/lib/session'
import { SuperAdminDirectoryFilters, useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface HistoryRow extends UpiStatusHistoryItem {
  upi_address: string
}

const DEFAULT_DESCRIPTION = 'pay and upload screenshot'
const DEFAULT_REMARK = 'check details before every payment'
const DEFAULT_MINVAL = '200'
const DEFAULT_MAXVAL = '100000'
const DEFAULT_REGEX = '^[a-z0-9]{12,22}$'

type BankFormState = {
  displayName: string
  upiAddress: string
  description: string
  remark: string
  minval: string
  maxval: string
  regexPattern: string
}

type OtpChallenge = {
  purpose: 'CREATE' | 'UPDATE'
  verificationId: string
  maskedMobile: string
  countryCode: string
  timeoutSeconds: number
}

const emptyCreateForm = (): BankFormState => ({
  displayName: '',
  upiAddress: '',
  description: DEFAULT_DESCRIPTION,
  remark: DEFAULT_REMARK,
  minval: DEFAULT_MINVAL,
  maxval: DEFAULT_MAXVAL,
  regexPattern: DEFAULT_REGEX,
})

const formFromRow = (row: BankAccountListItem): BankFormState => ({
  displayName: row.label,
  upiAddress: row.upi_address ?? '',
  description: row.supago_description ?? DEFAULT_DESCRIPTION,
  remark: row.supago_remark ?? DEFAULT_REMARK,
  minval: String(row.supago_minval ?? Number(DEFAULT_MINVAL)),
  maxval: String(row.supago_maxval ?? Number(DEFAULT_MAXVAL)),
  regexPattern: row.supago_regex_pattern ?? DEFAULT_REGEX,
})

export default function BanksPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('BANKS')
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    owner_user_id: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  })
  const [rows, setRows] = useState<PaymentMethodListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [altCreate, setAltCreate] = useState<'MANUAL_BANK' | 'USDT_TRC20' | null>(null)
  const [altLabel, setAltLabel] = useState('')
  const [altHolder, setAltHolder] = useState('')
  const [altAccount, setAltAccount] = useState('')
  const [altIfsc, setAltIfsc] = useState('')
  const [altBankName, setAltBankName] = useState('')
  const [altWallet, setAltWallet] = useState('')
  const [altOwnerId, setAltOwnerId] = useState('')
  const [editing, setEditing] = useState<BankAccountListItem | null>(null)
  const [form, setForm] = useState<BankFormState>(emptyCreateForm)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<PaymentMethodListItem | null>(null)
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [merchantLinksFor, setMerchantLinksFor] = useState<string | null>(null)
  const [merchantLinks, setMerchantLinks] = useState<BankMerchantLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const merchantLinksForRef = useRef<string | null>(null)
  merchantLinksForRef.current = merchantLinksFor

  const canEdit = hasMenu(menus, 'BANKS', 'can_edit')

  const refreshMerchantLinks = useCallback(
    async (bankId: string): Promise<boolean> => {
      if (!accessToken) return false
      setLoadingLinks(true)
      try {
        const links = await apiRequest<BankMerchantLink[]>(
          `/api/v1/bank-accounts/${bankId}/merchant-links`,
          { token: accessToken },
        )
        setMerchantLinks(links)
        return true
      } catch (caught) {
        toast.error(
          caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load merchant links',
        )
        return false
      } finally {
        setLoadingLinks(false)
      }
    },
    [accessToken],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))
    if (filters.q) query.set('q', filters.q)
    if (filters.status) query.set('status', filters.status)
    if (filters.owner_user_id) query.set('owner_user_id', filters.owner_user_id)
    try {
      const result = await apiListRequest<PaymentMethodListItem>(`/api/v1/payment-methods?${query}`)
      setRows(result.items)
      setPagination(result.pagination)
      const openBankId = merchantLinksForRef.current
      if (openBankId) await refreshMerchantLinks(openBankId)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (${caught.requestId})` : ''}` : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [filters.page, filters.page_size, filters.q, filters.status, filters.owner_user_id, refreshMerchantLinks])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  useBankListSync({ enabled: ready && allowed, onRefresh: load })

  const { isSuperAdmin, admins, merchants } = useSuperAdminDirectory(accessToken, user?.role)
  const ownerOptions = user
    ? [{ id: user.id, username: user.username }, ...admins.filter((row) => row.id !== user.id)]
    : admins

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleFormChange = (patch: Partial<BankFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleCloseForm = () => {
    setCreating(false)
    setEditing(null)
    setForm(emptyCreateForm())
    setOtpChallenge(null)
    setOtpCode('')
  }

  const handleOpenCreate = () => {
    setAltCreate(null)
    setEditing(null)
    setForm(emptyCreateForm())
    setCreating(true)
  }

  const openAltCreate = (kind: 'MANUAL_BANK' | 'USDT_TRC20') => {
    setCreating(false)
    setEditing(null)
    setAltCreate(kind)
    setAltLabel('')
    setAltHolder('')
    setAltAccount('')
    setAltIfsc('')
    setAltBankName('')
    setAltWallet('')
    setAltOwnerId(user?.role === 'BANKER' ? user.id : '')
  }

  const submitAltCreate = async () => {
    if (!accessToken || !altCreate) return
    setSubmitting('alt-create')
    try {
      if (altCreate === 'MANUAL_BANK') {
        await apiRequest('/api/v1/payment-methods/manual-bank', {
          method: 'POST',
          token: accessToken,
          body: {
            label: altLabel,
            account_holder_name: altHolder,
            account_number: altAccount,
            ifsc: altIfsc,
            ...(altBankName ? { bank_name: altBankName } : {}),
            ...(altOwnerId ? { owner_user_id: altOwnerId } : {}),
          },
        })
        toast.success('Manual bank method created')
      } else {
        await apiRequest('/api/v1/payment-methods/usdt-trc20', {
          method: 'POST',
          token: accessToken,
          body: {
            label: altLabel,
            wallet_address: altWallet,
            ...(altOwnerId ? { owner_user_id: altOwnerId } : {}),
          },
        })
        toast.success('USDT/TRC20 method created')
      }
      setAltCreate(null)
      void load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Create failed')
    } finally {
      setSubmitting(null)
    }
  }

  const handleOpenEdit = async (row: PaymentMethodListItem) => {
    if (row.method_kind !== 'UPI' || !row.bank_account_id || !accessToken) return
    const bankId = row.bank_account_id
    setAltCreate(null)
    setCreating(false)
    try {
      const bank = await apiRequest<BankAccountListItem>(`/api/v1/bank-accounts/${bankId}`, {
        token: accessToken,
      })
      setEditing(bank)
      setForm(formFromRow(bank))
    } catch (caught) {
      setEditing(null)
      toast.error(
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load bank for edit',
      )
    }
  }

  const buildSupagoBody = () => {
    // Min/Max/Regex are fixed defaults — not shown in the UI.
    return {
      upi_address: form.upiAddress.trim().toLowerCase(),
      display_name: form.displayName.trim(),
      bank_name: form.displayName.trim(),
      description: form.description.trim() || DEFAULT_DESCRIPTION,
      remark: form.remark.trim() || DEFAULT_REMARK,
      minval: Number(DEFAULT_MINVAL),
      maxval: Number(DEFAULT_MAXVAL),
      regex_pattern: DEFAULT_REGEX,
    }
  }

  const mutateBank = async (otp?: { verificationId: string; code: string }) => {
    if (!accessToken) return
    const base = buildSupagoBody()
    const otpFields = otp
      ? { otp_verification_id: otp.verificationId, otp_code: otp.code }
      : {}

    if (editing) {
      await apiRequest(`/api/v1/bank-accounts/${editing.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          display_name: base.display_name,
          bank_name: base.bank_name,
          upi_address: base.upi_address,
          description: base.description,
          remark: base.remark,
          minval: base.minval,
          maxval: base.maxval,
          regex_pattern: base.regex_pattern,
          ...otpFields,
        },
      })
      toast.success('Bank updated on panel merchants and CRM')
    } else {
      const created = await apiRequest<BankAccountListItem>('/api/v1/bank-accounts', {
        method: 'POST',
        token: accessToken,
        body: { ...base, ...otpFields },
      })
      toast.success(
        created.status === 'ACTIVE'
          ? 'Bank account added and enabled.'
          : 'Bank account added (disabled). Enable when ready.',
      )
    }
    setOtpChallenge(null)
    setOtpCode('')
    handleCloseForm()
    await load()
  }

  const requestBankOtp = async (purpose: 'CREATE' | 'UPDATE') => {
    if (!accessToken) return null
    const body: Record<string, string> = { purpose }
    if (purpose === 'UPDATE' && editing) {
      body.bank_account_id = editing.id
    }
    return apiRequest<{
      verification_id: string
      masked_mobile: string
      timeout_seconds: number
      country_code: string
    }>('/api/v1/otp/bank-mutation/send', {
      method: 'POST',
      token: accessToken,
      body,
    })
  }

  const handleSaveWithOtp = async () => {
    if (!accessToken || submitting || otpSending) return
    const purpose: 'CREATE' | 'UPDATE' = editing ? 'UPDATE' : 'CREATE'
    setSubmitting(purpose === 'CREATE' ? 'create' : `edit-${editing?.id ?? ''}`)
    setOtpSending(true)
    try {
      const sent = await requestBankOtp(purpose)
      if (!sent) return
      setOtpChallenge({
        purpose,
        verificationId: sent.verification_id,
        maskedMobile: sent.masked_mobile,
        countryCode: sent.country_code,
        timeoutSeconds: sent.timeout_seconds,
      })
      setOtpCode('')
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.displayMessage() : ''
      // Local/dev when QP_SMS_OTP_ENABLED=false — save without OTP.
      if (
        caught instanceof ApiClientError &&
        caught.code === 'VALIDATION_FAILED' &&
        /SMS OTP is disabled/i.test(message)
      ) {
        try {
          await mutateBank()
        } catch (inner) {
          toast.error(inner instanceof ApiClientError ? inner.displayMessage() : 'Could not save bank')
        }
      } else {
        toast.error(message || 'Could not send OTP')
      }
    } finally {
      setOtpSending(false)
      setSubmitting(null)
    }
  }

  const handleConfirmOtp = async () => {
    if (!accessToken || !otpChallenge || submitting) return
    const code = otpCode.trim()
    if (!/^\d{4,8}$/.test(code)) {
      toast.error('Enter the OTP from the SMS')
      return
    }
    setSubmitting('otp-confirm')
    try {
      await mutateBank({ verificationId: otpChallenge.verificationId, code })
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not save bank')
    } finally {
      setSubmitting(null)
    }
  }

  const handleResendOtp = async () => {
    if (!accessToken || !otpChallenge || otpSending) return
    setOtpSending(true)
    try {
      const sent = await requestBankOtp(otpChallenge.purpose)
      if (!sent) return
      setOtpChallenge({
        purpose: otpChallenge.purpose,
        verificationId: sent.verification_id,
        maskedMobile: sent.masked_mobile,
        countryCode: sent.country_code,
        timeoutSeconds: sent.timeout_seconds,
      })
      setOtpCode('')
      toast.success('OTP resent')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not resend OTP')
    } finally {
      setOtpSending(false)
    }
  }

  const handleResyncSupago = async (id: string) => {
    if (!accessToken || submitting) return
    setSubmitting(`resync-${id}`)
    try {
      const result = await apiRequest<{
        supago_linked?: boolean
        crici_linked?: number
      }>(`/api/v1/bank-accounts/${id}/resync-supago`, {
        method: 'POST',
        token: accessToken,
        body: {},
      })
      const parts: string[] = []
      if (result.supago_linked) parts.push('Supago')
      if ((result.crici_linked ?? 0) > 0) parts.push(`Crici (${result.crici_linked})`)
      toast.success(parts.length > 0 ? `Linked: ${parts.join(', ')}` : 'Resync complete')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not resync merchants')
    } finally {
      setSubmitting(null)
    }
  }

  const handleStatus = async (row: PaymentMethodListItem, status: 'ACTIVE' | 'DISABLED' | 'CLOSED') => {
    if (!accessToken || submitting) return
    setSubmitting(row.id)
    try {
      if (row.method_kind === 'UPI') {
        const bankId = row.bank_account_id
        if (!bankId) throw new Error('Missing bank account')
        if (status === 'CLOSED') {
          await apiRequest(`/api/v1/bank-accounts/${bankId}/close`, {
            method: 'POST',
            token: accessToken,
            body: { reason: 'Closed from Payment Methods' },
          })
        } else {
          await apiRequest(`/api/v1/bank-accounts/${bankId}/status`, {
            method: 'POST',
            token: accessToken,
            body: { status },
          })
        }
      } else if (row.method_kind === 'MANUAL_BANK') {
        await apiRequest(`/api/v1/payment-methods/manual-bank/${row.id}/status`, {
          method: 'POST',
          token: accessToken,
          body: { status },
        })
      } else {
        await apiRequest(`/api/v1/payment-methods/usdt-trc20/${row.id}/status`, {
          method: 'POST',
          token: accessToken,
          body: { status },
        })
      }
      toast.success(
        status === 'CLOSED' ? 'Method closed' : status === 'DISABLED' ? 'Method disabled' : 'Method enabled',
      )
      setCloseTarget(null)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setSubmitting(null)
    }
  }

  const handleClose = async () => {
    if (!closeTarget) return
    await handleStatus(closeTarget, 'CLOSED')
  }

  const handleHistory = async (row: PaymentMethodListItem) => {
    if (!accessToken || row.method_kind !== 'UPI' || !row.bank_account_id) return
    const bankId = row.bank_account_id
    setMerchantLinksFor(null)
    setMerchantLinks([])
    try {
      const upis = await apiListRequest<UpiAccountListItem>(
        `/api/v1/upi-accounts?bank_account_id=${bankId}&page_size=25`,
        { token: accessToken },
      )
      const entries: HistoryRow[] = []
      for (const upi of upis.items) {
        const items = await apiRequest<UpiStatusHistoryItem[]>(`/api/v1/upi-accounts/${upi.id}/history`, {
          token: accessToken,
        })
        for (const item of items) {
          entries.push({ ...item, upi_address: upi.upi_address })
        }
      }
      entries.sort((left, right) => right.created_at.localeCompare(left.created_at))
      setHistoryFor(row.label)
      setHistory(entries)
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load history')
    }
  }

  const handleMerchantLinks = async (row: PaymentMethodListItem) => {
    if (!accessToken || row.method_kind !== 'UPI' || !row.bank_account_id) return
    const bankId = row.bank_account_id
    if (merchantLinksFor === bankId) {
      setMerchantLinksFor(null)
      setMerchantLinks([])
      return
    }
    setMerchantLinksFor(bankId)
    setHistoryFor(null)
    const ok = await refreshMerchantLinks(bankId)
    if (!ok) {
      setMerchantLinksFor(null)
      setMerchantLinks([])
    }
  }

  const handleMerchantLinkStatus = async (
    bankId: string,
    merchantId: string,
    status: 'ACTIVE' | 'DISABLED',
  ) => {
    if (!accessToken || submitting) return
    setSubmitting(`link-${merchantId}`)
    try {
      const links = await apiRequest<BankMerchantLink[]>(
        `/api/v1/bank-accounts/${bankId}/merchant-links/${merchantId}/status`,
        {
          method: 'POST',
          token: accessToken,
          body: { status },
        },
      )
      setMerchantLinks(links)
      toast.success(status === 'ACTIVE' ? 'Enabled for merchant' : 'Disabled for merchant')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update merchant link')
    } finally {
      setSubmitting(null)
    }
  }

  const formOpen = creating || editing !== null
  const merchantLinksBankLabel = merchantLinksFor
    ? rows.find((row) => row.bank_account_id === merchantLinksFor)?.label ?? 'Bank'
    : null

  const methodKindLabel = (kind: PaymentMethodListItem['method_kind']) => {
    if (kind === 'MANUAL_BANK') return 'Manual bank'
    if (kind === 'USDT_TRC20') return 'USDT/TRC20'
    return 'UPI'
  }

  return (
    <AppShell title="Payment Methods" role={user.role} menus={menus}>
      <PageHeader
        title="Payment Methods"
        subtitle="UPI, Manual bank, and USDT/TRC20 — one row per Banker instrument"
        action={
          hasMenu(menus, 'BANKS', 'can_create') ? (
            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={handleOpenCreate}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add UPI
              </PrimaryButton>
              <PrimaryButton onClick={() => void openAltCreate('MANUAL_BANK')}>Add Manual bank</PrimaryButton>
              <PrimaryButton onClick={() => void openAltCreate('USDT_TRC20')}>Add USDT/TRC20</PrimaryButton>
            </div>
          ) : null
        }
      />
      <FilterBar
        onApply={() => void load()}
        onClear={() => void setFilters({ q: '', status: '', owner_user_id: '', page: 1 })}
        onReload={() => void load()}
      >
        <FormField label="Search">
          <Input placeholder="Search" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} aria-label="Search" />
        </FormField>
        <FormField label="Status">
          <Select
            value={filters.status}
            onChange={(event) => void setFilters({ status: event.target.value, page: 1 })}
            aria-label="Status"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
            <option value="CLOSED">CLOSED</option>
          </Select>
        </FormField>
        {isSuperAdmin ? (
          <SuperAdminDirectoryFilters
            admins={ownerOptions}
            merchants={merchants}
            adminId={filters.owner_user_id}
            onAdminChange={(value) => void setFilters({ owner_user_id: value, page: 1 })}
            showMerchant={false}
          />
        ) : null}
        <div>
          <ExportButton disabled={rows.length === 0} />
        </div>
      </FilterBar>

      {formOpen ? (
        <div className="mb-4">
          <FormShell
            submitLabel={editing ? 'Save' : 'Add'}
            onCancel={handleCloseForm}
            onSubmit={() => void handleSaveWithOtp()}
          >
            <FormSection
              title={editing ? 'Edit Bank' : 'Add Bank'}
              description={
                editing
                  ? 'Updates this UPI on every Deposit-Managed-By–eligible Exchange Master (no picker). Supago starts DISABLED; Crici create goes live (ACTIVE).'
                  : 'Exchange Masters come from Deposit Managed By (no picker). Supago starts DISABLED; Crici create goes live (ACTIVE).'
              }
            >
              <FormGrid>
                <FormField label="Bank Name" required>
                  <Input
                    value={form.displayName}
                    onChange={(event) => handleFormChange({ displayName: event.target.value })}
                    aria-label="Bank name"
                  />
                </FormField>
                <FormField label="UPI Address" required>
                  <Input
                    value={form.upiAddress}
                    onChange={(event) => handleFormChange({ upiAddress: event.target.value })}
                    aria-label="UPI address"
                  />
                </FormField>
                <FormField label="Description">
                  <Input
                    value={form.description}
                    onChange={(event) => handleFormChange({ description: event.target.value })}
                    aria-label="Description"
                  />
                </FormField>
                <FormField label="Remark">
                  <Input
                    value={form.remark}
                    onChange={(event) => handleFormChange({ remark: event.target.value })}
                    aria-label="Remark"
                  />
                </FormField>
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {altCreate ? (
        <div className="mb-4">
          <FormShell
            submitLabel={submitting === 'alt-create' ? 'Saving…' : 'Add'}
            onCancel={() => setAltCreate(null)}
            onSubmit={() => void submitAltCreate()}
          >
            <FormSection
              title={altCreate === 'MANUAL_BANK' ? 'Add Manual bank' : 'Add USDT/TRC20'}
              description={
                altCreate === 'MANUAL_BANK'
                  ? 'Creates a Manual bank collection instrument for the Banker (no panel slot).'
                  : 'Creates a USDT/TRC20 wallet instrument for the Banker (no panel slot).'
              }
            >
              <FormGrid>
                <FormField label="Label" required>
                  <Input value={altLabel} onChange={(e) => setAltLabel(e.target.value)} aria-label="Label" />
                </FormField>
                {user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? (
                  <FormField label={`${bankerLabel()} owner`} required>
                    <Select
                      value={altOwnerId}
                      onChange={(e) => setAltOwnerId(e.target.value)}
                      aria-label={`${bankerLabel()} owner`}
                    >
                      <option value="">Select owner</option>
                      {ownerOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.username}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : null}
                {altCreate === 'MANUAL_BANK' ? (
                  <>
                    <FormField label="Account holder" required>
                      <Input
                        value={altHolder}
                        onChange={(e) => setAltHolder(e.target.value)}
                        aria-label="Account holder"
                      />
                    </FormField>
                    <FormField label="Account number" required>
                      <Input
                        value={altAccount}
                        onChange={(e) => setAltAccount(e.target.value)}
                        aria-label="Account number"
                      />
                    </FormField>
                    <FormField label="IFSC" required>
                      <Input value={altIfsc} onChange={(e) => setAltIfsc(e.target.value)} aria-label="IFSC" />
                    </FormField>
                    <FormField label="Bank name">
                      <Input
                        value={altBankName}
                        onChange={(e) => setAltBankName(e.target.value)}
                        aria-label="Bank name"
                      />
                    </FormField>
                  </>
                ) : (
                  <FormField label="TRC20 wallet address" required>
                    <Input
                      value={altWallet}
                      onChange={(e) => setAltWallet(e.target.value)}
                      aria-label="Wallet address"
                    />
                  </FormField>
                )}
              </FormGrid>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'type', heading: 'TYPE' },
            { key: 'owner', heading: 'OWNER' },
            { key: 'label', heading: 'LABEL' },
            { key: 'detail', heading: 'DETAIL' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          onRowClick={(index) => {
            const row = rows[index]
            if (row?.method_kind === 'UPI') void handleMerchantLinks(row)
          }}
          expandedRowKey={merchantLinksFor}
          renderExpandedRow={() => (
            <div className="rounded border border-zinc-200 bg-white p-2">
              <div className="mb-1 flex justify-between text-xs">
                <p>
                  {merchantLabel()} status — {merchantLinksBankLabel} (bank Active if any {merchantLabel().toLowerCase()} is enabled)
                </p>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setMerchantLinksFor(null)
                    setMerchantLinks([])
                  }}
                >
                  Close
                </button>
              </div>
              {loadingLinks ? (
                <TableSkeleton />
              ) : (
                <DataTable
                  columns={[
                    ...(canSeeMerchants(user.role)
                      ? [{ key: 'merchant', heading: merchantLabel().toUpperCase() }]
                      : [{ key: 'merchant', heading: 'LINK' }]),
                    { key: 'panel', heading: 'PANEL' },
                    { key: 'status', heading: 'STATUS' },
                    { key: 'allowed', heading: 'ALLOWED' },
                    { key: 'action', heading: 'ACTION' },
                  ]}
                  rows={merchantLinks.map((link) => ({
                    merchant: canSeeMerchants(user.role)
                      ? (link.merchant_display_name ?? '—')
                      : 'Linked',
                    panel: link.integration_type,
                    status: <StatusBadge status={link.status} />,
                    allowed: link.allowed ? 'Yes' : 'No',
                    action: !link.allowed ? (
                      <span className="text-[11px] text-zinc-500">
                        Not linked — Super Admin must add this {bankerLabel()} on the {merchantLabel().toLowerCase()}&apos;s Deposit Managed By.
                      </span>
                    ) : canEdit ? (
                      <button
                        type="button"
                        className="text-[11px] font-medium underline disabled:opacity-50"
                        style={{ color: link.status === 'ACTIVE' ? 'var(--qp-danger)' : 'var(--qp-success)' }}
                        disabled={submitting === `link-${link.merchant_id}`}
                        aria-label={link.status === 'ACTIVE' ? `Disable for ${merchantLabel()}` : `Enable for ${merchantLabel()}`}
                        onClick={() => {
                          if (!merchantLinksFor) return
                          void handleMerchantLinkStatus(
                            merchantLinksFor,
                            link.merchant_id,
                            link.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          )
                        }}
                      >
                        {submitting === `link-${link.merchant_id}`
                          ? 'Saving…'
                          : link.status === 'ACTIVE'
                            ? 'Disable'
                            : 'Enable'}
                      </button>
                    ) : (
                      '—'
                    ),
                  }))}
                  empty={<EmptyState message="No merchants" />}
                />
              )}
            </div>
          )}
          rows={rows.map((row) => ({
            _rowKey: row.method_kind === 'UPI' && row.bank_account_id ? row.bank_account_id : row.id,
            ...(merchantLinksFor && row.bank_account_id === merchantLinksFor
              ? { _rowClass: 'bg-[var(--qp-primary-light)]' }
              : {}),
            type: methodKindLabel(row.method_kind),
            owner: row.owner_username,
            label: row.label,
            detail: row.detail_masked,
            status: <StatusBadge status={row.status} />,
            actions: (
              <span
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {canEdit && row.method_kind === 'UPI' && row.status !== 'CLOSED' ? (
                  <IconButton
                    icon={<Pencil size={15} strokeWidth={1.75} />}
                    tooltip="Edit"
                    onClick={() => void handleOpenEdit(row)}
                  />
                ) : null}
                {canEdit && row.method_kind === 'UPI' && row.bank_account_id && row.status !== 'CLOSED' ? (
                  <IconButton
                    icon={<RefreshCw size={15} strokeWidth={1.75} />}
                    tooltip="Resync & link merchants"
                    onClick={() => void handleResyncSupago(row.bank_account_id!)}
                  />
                ) : null}
                {canEdit && row.status === 'ACTIVE' ? (
                  <IconButton
                    icon={<Ban size={15} strokeWidth={1.75} />}
                    tooltip="Disable"
                    onClick={() => void handleStatus(row, 'DISABLED')}
                  />
                ) : null}
                {canEdit && row.status === 'DISABLED' ? (
                  <IconButton
                    icon={<CircleCheck size={15} strokeWidth={1.75} />}
                    tooltip="Enable"
                    variant="primary"
                    onClick={() => void handleStatus(row, 'ACTIVE')}
                  />
                ) : null}
                {row.method_kind === 'UPI' ? (
                  <IconButton
                    icon={<Building2 size={15} strokeWidth={1.75} />}
                    tooltip={merchantLabel({ plural: true })}
                    onClick={() => void handleMerchantLinks(row)}
                  />
                ) : null}
                {row.method_kind === 'UPI' ? (
                  <IconButton
                    icon={<History size={15} strokeWidth={1.75} />}
                    tooltip="View history"
                    onClick={() => void handleHistory(row)}
                  />
                ) : null}
                {row.method_kind === 'UPI' && row.bank_account_id ? (
                  <IconButton
                    icon={<ScrollText size={15} strokeWidth={1.75} />}
                    tooltip="Transactions History"
                    href={`/banks/${row.bank_account_id}/history`}
                  />
                ) : null}
                {canEdit && row.status !== 'CLOSED' ? (
                  <IconButton
                    icon={<Trash2 size={15} strokeWidth={1.75} />}
                    tooltip="Close"
                    variant="danger"
                    onClick={() => setCloseTarget(row)}
                  />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No payment methods found" />}
          pagination={pagination ?? undefined}
          onPage={(page) => void setFilters({ page })}
          onPageSize={(size) => void setFilters({ page_size: size, page: 1 })}
        />
      )}
      {historyFor ? (
        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
          <div className="mb-1 flex justify-between text-xs">
            <p>History — {historyFor}</p>
            <button type="button" className="underline" onClick={() => setHistoryFor(null)}>Close</button>
          </div>
          <DataTable
            columns={[
              { key: 'upi', heading: 'UPI' },
              { key: 'when', heading: 'TIME' },
              { key: 'from', heading: 'FROM' },
              { key: 'to', heading: 'TO' },
              { key: 'reason', heading: 'REASON' },
            ]}
            rows={history.map((row) => ({
              upi: row.upi_address,
              when: new Date(row.created_at).toLocaleString(),
              from: row.from_status ?? '—',
              to: row.to_status,
              reason: row.reason ?? '—',
            }))}
            empty={<EmptyState message="No history" />}
          />
        </div>
      ) : null}
      {closeTarget ? (
        <ConfirmDialog
          title={`Close ${closeTarget.label}?`}
          subtitle="Soft close to CLOSED. The row stays for history."
          confirmLabel="Close"
          loading={submitting === closeTarget.id}
          onCancel={() => setCloseTarget(null)}
          onConfirm={() => void handleClose()}
        />
      ) : null}
      {otpChallenge ? (
        <Modal
          title="Verify SMS OTP"
          ariaLabel="Verify SMS OTP"
          footer={
            <>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                onClick={() => {
                  setOtpChallenge(null)
                  setOtpCode('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
                disabled={otpSending || submitting === 'otp-confirm'}
                onClick={() => void handleResendOtp()}
              >
                {otpSending ? 'Sending…' : 'Resend'}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--qp-primary)' }}
                disabled={submitting === 'otp-confirm' || otpSending}
                onClick={() => void handleConfirmOtp()}
              >
                {submitting === 'otp-confirm' ? 'Saving…' : 'Confirm'}
              </button>
            </>
          }
        >
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            Enter the code sent to {otpChallenge.maskedMobile}. Valid about{' '}
            {otpChallenge.timeoutSeconds}s.
          </p>
          <FormField label="OTP" required>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otpCode}
              aria-label="SMS OTP"
              placeholder="6-digit code"
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
            />
          </FormField>
        </Modal>
      ) : null}
    </AppShell>
  )
}
