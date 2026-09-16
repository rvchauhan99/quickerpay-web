'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import type {
  BankAccountListItem,
  BankMerchantLink,
  EligibleBankMerchant,
  Pagination,
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
  const [rows, setRows] = useState<BankAccountListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BankAccountListItem | null>(null)
  const [form, setForm] = useState<BankFormState>(emptyCreateForm)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<BankAccountListItem | null>(null)
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [merchantLinksFor, setMerchantLinksFor] = useState<string | null>(null)
  const [merchantLinks, setMerchantLinks] = useState<BankMerchantLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [eligibleMerchants, setEligibleMerchants] = useState<EligibleBankMerchant[]>([])
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>([])
  const merchantLinksForRef = useRef<string | null>(null)
  merchantLinksForRef.current = merchantLinksFor

  const canEdit = hasMenu(menus, 'BANKS', 'can_edit')

  const loadEligibleMerchants = useCallback(async () => {
    if (!accessToken) return
    try {
      const list = await apiRequest<EligibleBankMerchant[]>('/api/v1/bank-accounts/eligible-merchants', {
        token: accessToken,
      })
      setEligibleMerchants(list)
      setSelectedMerchantIds(list.map((m) => m.id))
    } catch (caught) {
      setEligibleMerchants([])
      setSelectedMerchantIds([])
      toast.error(
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load eligible merchants',
      )
    }
  }, [accessToken])

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
      const result = await apiListRequest<BankAccountListItem>(`/api/v1/bank-accounts?${query}`)
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
    setEligibleMerchants([])
    setSelectedMerchantIds([])
  }

  const handleOpenCreate = () => {
    setEditing(null)
    setForm(emptyCreateForm())
    setCreating(true)
    void loadEligibleMerchants()
  }

  const handleOpenEdit = async (row: BankAccountListItem) => {
    setCreating(false)
    setEditing(row)
    setForm(formFromRow(row))
    if (!accessToken) return
    try {
      const [list, links] = await Promise.all([
        apiRequest<EligibleBankMerchant[]>('/api/v1/bank-accounts/eligible-merchants', {
          token: accessToken,
        }),
        apiRequest<BankMerchantLink[]>(`/api/v1/bank-accounts/${row.id}/merchant-links`, {
          token: accessToken,
        }),
      ])
      setEligibleMerchants(list)
      // Prefer linked merchants that are still eligible, then include remaining eligible
      // so Edit can add Crici/Supago links the same way Create defaults to all.
      const linkedIds = new Set(links.map((link) => link.merchant_id))
      const linkedEligible = list.filter((m) => linkedIds.has(m.id)).map((m) => m.id)
      const remainingEligible = list.filter((m) => !linkedIds.has(m.id)).map((m) => m.id)
      setSelectedMerchantIds([...linkedEligible, ...remainingEligible])
    } catch (caught) {
      setEligibleMerchants([])
      setSelectedMerchantIds([])
      toast.error(
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not load eligible merchants',
      )
    }
  }

  const handleToggleMerchant = (merchantId: string) => {
    setSelectedMerchantIds((prev) =>
      prev.includes(merchantId) ? prev.filter((id) => id !== merchantId) : [...prev, merchantId],
    )
  }

  const buildSupagoBody = () => {
    const minval = Number.parseInt(form.minval, 10)
    const maxval = Number.parseInt(form.maxval, 10)
    return {
      upi_address: form.upiAddress.trim().toLowerCase(),
      display_name: form.displayName.trim(),
      bank_name: form.displayName.trim(),
      description: form.description.trim() || DEFAULT_DESCRIPTION,
      remark: form.remark.trim() || DEFAULT_REMARK,
      minval: Number.isFinite(minval) ? minval : Number(DEFAULT_MINVAL),
      maxval: Number.isFinite(maxval) ? maxval : Number(DEFAULT_MAXVAL),
      regex_pattern: form.regexPattern.trim() || DEFAULT_REGEX,
    }
  }

  const mutateBank = async (otp?: { verificationId: string; code: string }) => {
    if (!accessToken) return
    const base = buildSupagoBody()
    const otpFields = otp
      ? { otp_verification_id: otp.verificationId, otp_code: otp.code }
      : {}

    if (editing) {
      if (selectedMerchantIds.length === 0) {
        toast.error('Select at least one merchant')
        return
      }
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
          merchant_ids: selectedMerchantIds,
          ...otpFields,
        },
      })
      toast.success('Bank updated on panel merchants and CRM')
    } else {
      if (selectedMerchantIds.length === 0) {
        toast.error('Select at least one merchant')
        return
      }
      const created = await apiRequest<BankAccountListItem>('/api/v1/bank-accounts', {
        method: 'POST',
        token: accessToken,
        body: { ...base, merchant_ids: selectedMerchantIds, ...otpFields },
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

  const handleStatus = async (id: string, status: 'ACTIVE' | 'DISABLED') => {
    if (!accessToken || submitting) return
    setSubmitting(id)
    try {
      await apiRequest(`/api/v1/bank-accounts/${id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status },
      })
      toast.success(status === 'DISABLED' ? 'Account disabled' : 'Account enabled')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setSubmitting(null)
    }
  }

  const handleClose = async () => {
    if (!accessToken || !closeTarget || submitting) return
    setSubmitting(closeTarget.id)
    try {
      await apiRequest(`/api/v1/bank-accounts/${closeTarget.id}/close`, {
        method: 'POST',
        token: accessToken,
        body: { reason: 'Closed from Bank Details' },
      })
      setCloseTarget(null)
      toast.success('Account closed')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not close')
    } finally {
      setSubmitting(null)
    }
  }

  const handleHistory = async (row: BankAccountListItem) => {
    if (!accessToken) return
    setMerchantLinksFor(null)
    setMerchantLinks([])
    try {
      const upis = await apiListRequest<UpiAccountListItem>(
        `/api/v1/upi-accounts?bank_account_id=${row.id}&page_size=25`,
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

  const handleMerchantLinks = async (row: BankAccountListItem) => {
    if (!accessToken) return
    if (merchantLinksFor === row.id) {
      setMerchantLinksFor(null)
      setMerchantLinks([])
      return
    }
    setMerchantLinksFor(row.id)
    setHistoryFor(null)
    const ok = await refreshMerchantLinks(row.id)
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
    ? rows.find((row) => row.id === merchantLinksFor)?.label ?? 'Bank'
    : null

  return (
    <AppShell title="Bank Details" role={user.role} menus={menus}>
      <PageHeader
        title="Bank Details"
        action={
          hasMenu(menus, 'BANKS', 'can_create') ? (
            <PrimaryButton onClick={handleOpenCreate}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Bank
            </PrimaryButton>
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
                  ? 'Updates this UPI on the merchants you select (Supago and/or Crici), writes merchant links, then saves CRM.'
                  : 'Creates the UPI on the merchants you select (Deposit Managed By). Defaults to all eligible. Crici selections go live immediately (ACTIVE). Supago still starts disabled until Enable. Bank row is Active when any merchant link is enabled.'
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
                <FormField label="Min amount (₹)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.minval}
                    onChange={(event) => handleFormChange({ minval: event.target.value })}
                    aria-label="Min amount"
                  />
                </FormField>
                <FormField label="Max amount (₹)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.maxval}
                    onChange={(event) => handleFormChange({ maxval: event.target.value })}
                    aria-label="Max amount"
                  />
                </FormField>
                <FormField label="Regex pattern">
                  <Input
                    value={form.regexPattern}
                    onChange={(event) => handleFormChange({ regexPattern: event.target.value })}
                    aria-label="Regex pattern"
                  />
                </FormField>
              </FormGrid>
              <div className="mt-4">
                  <p className="mb-2 text-xs font-medium" style={{ color: 'var(--qp-text-secondary)' }}>
                    Merchants {editing ? '(linked + eligible)' : '(default: all)'}
                  </p>
                  {eligibleMerchants.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      No eligible merchants for this Admin under Deposit Managed By.
                    </p>
                  ) : (
                    <ul className="space-y-2" aria-label="Eligible merchants">
                      {eligibleMerchants.map((merchant) => {
                        const checked = selectedMerchantIds.includes(merchant.id)
                        return (
                          <li key={merchant.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              id={`merchant-${merchant.id}`}
                              checked={checked}
                              onChange={() => handleToggleMerchant(merchant.id)}
                              aria-label={`${merchant.display_name} (${merchant.integration_type})`}
                            />
                            <label htmlFor={`merchant-${merchant.id}`} className="cursor-pointer">
                              {merchant.display_name}{' '}
                              <span className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
                                {merchant.integration_type}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
            </FormSection>
          </FormShell>
        </div>
      ) : null}

      {loading ? <TableSkeleton /> : (
        <DataTable
          columns={[
            { key: 'owner', heading: 'OWNER' },
            { key: 'label', heading: 'LABEL' },
            { key: 'upi', heading: 'UPI ID' },
            { key: 'supago', heading: 'SUPAGO' },
            { key: 'status', heading: 'STATUS' },
            { key: 'actions', heading: 'ACTION' },
          ]}
          onRowClick={(index) => {
            const row = rows[index]
            if (row) void handleMerchantLinks(row)
          }}
          expandedRowKey={merchantLinksFor}
          renderExpandedRow={() => (
            <div className="rounded border border-zinc-200 bg-white p-2">
              <div className="mb-1 flex justify-between text-xs">
                <p>
                  Merchant status — {merchantLinksBankLabel} (bank Active if any merchant is enabled)
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
                    { key: 'merchant', heading: 'MERCHANT' },
                    { key: 'panel', heading: 'PANEL' },
                    { key: 'status', heading: 'STATUS' },
                    { key: 'allowed', heading: 'ALLOWED' },
                    { key: 'action', heading: 'ACTION' },
                  ]}
                  rows={merchantLinks.map((link) => ({
                    merchant: link.merchant_display_name,
                    panel: link.integration_type,
                    status: <StatusBadge status={link.status} />,
                    allowed: link.allowed ? 'Yes' : 'No',
                    action: !link.allowed ? (
                      <span className="text-[11px] text-zinc-500">
                        Not linked — Super Admin must add this Admin on the merchant&apos;s Deposit Managed By.
                      </span>
                    ) : canEdit ? (
                      <button
                        type="button"
                        className="text-[11px] font-medium underline disabled:opacity-50"
                        style={{ color: link.status === 'ACTIVE' ? 'var(--qp-danger)' : 'var(--qp-success)' }}
                        disabled={submitting === `link-${link.merchant_id}`}
                        aria-label={link.status === 'ACTIVE' ? 'Disable for merchant' : 'Enable for merchant'}
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
            _rowKey: row.id,
            ...(merchantLinksFor === row.id
              ? { _rowClass: 'bg-[var(--qp-primary-light)]' }
              : {}),
            owner: row.owner_username,
            label: row.label,
            upi: row.upi_address ?? '—',
            supago: row.supago_linked ? (
              <span className="text-[11px] font-medium" style={{ color: 'var(--qp-success)' }}>
                Linked
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">—</span>
            ),
            status: <StatusBadge status={row.status} />,
            actions: (
              <span
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {canEdit && row.status !== 'CLOSED' && row.status !== 'REJECTED' ? (
                  <IconButton
                    icon={<Pencil size={15} strokeWidth={1.75} />}
                    tooltip="Edit"
                    onClick={() => handleOpenEdit(row)}
                  />
                ) : null}
                {canEdit && row.status !== 'CLOSED' && row.status !== 'REJECTED' ? (
                  <IconButton
                    icon={<RefreshCw size={15} strokeWidth={1.75} />}
                    tooltip="Resync & link merchants"
                    onClick={() => void handleResyncSupago(row.id)}
                  />
                ) : null}
                {canEdit && row.status === 'ACTIVE' ? (
                  <IconButton
                    icon={<Ban size={15} strokeWidth={1.75} />}
                    tooltip="Disable"
                    onClick={() => void handleStatus(row.id, 'DISABLED')}
                  />
                ) : null}
                {canEdit && row.status === 'DISABLED' ? (
                  <IconButton
                    icon={<CircleCheck size={15} strokeWidth={1.75} />}
                    tooltip="Enable"
                    variant="primary"
                    onClick={() => void handleStatus(row.id, 'ACTIVE')}
                  />
                ) : null}
                <IconButton
                  icon={<Building2 size={15} strokeWidth={1.75} />}
                  tooltip="Merchants"
                  onClick={() => void handleMerchantLinks(row)}
                />
                <IconButton
                  icon={<History size={15} strokeWidth={1.75} />}
                  tooltip="View history"
                  onClick={() => void handleHistory(row)}
                />
                <IconButton
                  icon={<ScrollText size={15} strokeWidth={1.75} />}
                  tooltip="Transactions History"
                  href={`/banks/${row.id}/history`}
                />
                {canEdit && row.status !== 'CLOSED' && row.status !== 'REJECTED' ? (
                  <IconButton
                    icon={<Trash2 size={15} strokeWidth={1.75} />}
                    tooltip="Delete"
                    variant="danger"
                    onClick={() => setCloseTarget(row)}
                  />
                ) : null}
              </span>
            ),
          }))}
          empty={<EmptyState message="No bank accounts found" />}
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
          subtitle="Soft close to CLOSED. The row stays for history. Create the same UPI again to reopen it in place (starts DISABLED)."
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
