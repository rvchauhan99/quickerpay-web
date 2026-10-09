'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { BankAdminMode, MerchantDetail, MerchantRate } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { RateInput } from '@/components/forms/RateInput'
import { DataTable, EmptyState, StatusBadge, TableSkeleton } from '@/components/ui/FilterBar'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { BankAdminsFormSection } from '@/components/forms/BankAdminsFormSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { apiListRequest, apiRequest, ApiClientError } from '@/lib/api'
import { agentLabel, bankerLabel, merchantLabel } from '@/lib/labels'
import { RateDisplay } from '@/lib/money'
import { hasMenu } from '@/lib/session'
import { useSuperAdminDirectory } from '@/lib/useDirectory'
import { useTenantScreen } from '@/lib/useTenantScreen'

interface SupagoStatus {
  connected: boolean
  uname?: string
  bcode?: string
  transaction_code?: string | null
  expires_at?: string
  last_error?: string
}

interface CriciStatus {
  connected: boolean
  credentials_stored?: boolean
  needs_reconnect?: boolean
  requires_2fa?: boolean
  username?: string
  expires_at?: string
  last_error?: string
}

type WithdrawRoutingMode = 'queue' | 'direct'
type PanelIntegrationType = 'none' | 'supago' | 'crici'

export default function MerchantDetailPage() {
  const params = useParams<{ id: string }>()
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('MERCHANTS')
  const { isSuperAdmin, admins } = useSuperAdminDirectory(accessToken, user?.role)
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null)
  const [history, setHistory] = useState<MerchantRate[]>([])
  const [payinBp, setPayinBp] = useState(0)
  const [payoutBp, setPayoutBp] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingRate, setSavingRate] = useState<'PAYIN' | 'PAYOUT' | null>(null)
  const [routingMode, setRoutingMode] = useState<WithdrawRoutingMode>('queue')
  const [routingAdminId, setRoutingAdminId] = useState('')
  const [savingRouting, setSavingRouting] = useState(false)
  const [bankAdminMode, setBankAdminMode] = useState<BankAdminMode>('ALL')
  const [bankAdminIds, setBankAdminIds] = useState<string[]>([])
  const [savingBankAdmins, setSavingBankAdmins] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState<'SUSPENDED' | 'ACTIVE' | null>(null)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [portalPassword, setPortalPassword] = useState('')
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalOncePassword, setPortalOncePassword] = useState<string | null>(null)
  const [portalDisableConfirm, setPortalDisableConfirm] = useState(false)
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; username: string }>>([])
  const [agentUserId, setAgentUserId] = useState('')
  const [agentPayinBp, setAgentPayinBp] = useState(0)
  const [agentPayoutBp, setAgentPayoutBp] = useState(0)
  const [savingAgent, setSavingAgent] = useState(false)

  // Supago state
  const [supagoStatus, setSupagoStatus] = useState<SupagoStatus | null>(null)
  const [supagoUsername, setSupagoUsername] = useState('')
  const [supagoPassword, setSupagoPassword] = useState('')
  const [supagoTransactionCode, setSupagoTransactionCode] = useState('')
  const [supagoLoading, setSupagoLoading] = useState(false)
  const [supagoError, setSupagoError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [updateCredsOpen, setUpdateCredsOpen] = useState(false)

  // Crici state — password is write-only; never shown after connect
  const [criciStatus, setCriciStatus] = useState<CriciStatus | null>(null)
  const [criciUsername, setCriciUsername] = useState('')
  const [criciPassword, setCriciPassword] = useState('')
  const [criciTotpCode, setCriciTotpCode] = useState('')
  const [criciLoading, setCriciLoading] = useState(false)
  const [criciError, setCriciError] = useState<string | null>(null)
  const [confirmCriciDisconnect, setConfirmCriciDisconnect] = useState(false)
  const [criciUpdateOpen, setCriciUpdateOpen] = useState(false)
  const [panelChoice, setPanelChoice] = useState<PanelIntegrationType>('none')

  const loadSupagoStatus = useCallback(async (token: string, id: string) => {
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${id}/supago/status`, { token })
      setSupagoStatus(status)
      setSupagoTransactionCode(status.transaction_code ?? '')
    } catch {
      setSupagoStatus({ connected: false })
    }
  }, [])

  const loadCriciStatus = useCallback(async (token: string, id: string) => {
    try {
      const status = await apiRequest<CriciStatus>(`/api/v1/merchants/${id}/crici/status`, { token })
      setCriciStatus(status)
    } catch {
      setCriciStatus({ connected: false })
    }
  }, [])

  const applyRoutingFromDetail = (detail: MerchantDetail) => {
    if (detail.default_payout_banker_user_id) {
      setRoutingMode('direct')
      setRoutingAdminId(detail.default_payout_banker_user_id)
      return
    }
    setRoutingMode('queue')
    setRoutingAdminId('')
  }

  const applyBankAdminsFromDetail = (detail: MerchantDetail) => {
    setBankAdminMode(detail.bank_banker_mode ?? 'ALL')
    setBankAdminIds(detail.bank_banker_user_ids ?? [])
  }

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}`, { token: accessToken })
      const rates = await apiRequest<MerchantRate[]>(`/api/v1/merchants/${params.id}/rates`, { token: accessToken })
      setMerchant(detail)
      applyRoutingFromDetail(detail)
      applyBankAdminsFromDetail(detail)
      setHistory(rates)
      setPayinBp(detail.rates.find((row) => row.rate_kind === 'PAYIN')?.rate_bp ?? 0)
      setPayoutBp(detail.rates.find((row) => row.rate_kind === 'PAYOUT')?.rate_bp ?? 0)
      setAgentUserId(detail.agent_user_id ?? '')
      setAgentPayinBp(detail.agent_rates?.find((row) => row.rate_kind === 'PAYIN')?.rate_bp ?? 0)
      setAgentPayoutBp(detail.agent_rates?.find((row) => row.rate_kind === 'PAYOUT')?.rate_bp ?? 0)
      void loadSupagoStatus(accessToken, params.id)
      void loadCriciStatus(accessToken, params.id)
      try {
        const agents = await apiListRequest<{ id: string; username: string; status: string }>(
          '/api/v1/agents?page_size=100&status=ACTIVE',
          { token: accessToken },
        )
        setAgentOptions(agents.items.map((a) => ({ id: a.id, username: a.username })))
      } catch {
        setAgentOptions([])
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, params.id, loadSupagoStatus, loadCriciStatus])

  useEffect(() => {
    if (ready && allowed) void load()
  }, [ready, allowed, load])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden

  const handleSaveKind = async (kind: 'PAYIN' | 'PAYOUT') => {
    if (!accessToken || !params.id || savingRate) return
    setSavingRate(kind)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/rates`, {
        method: 'POST',
        token: accessToken,
        body: { rate_kind: kind, rate_bp: kind === 'PAYIN' ? payinBp : payoutBp },
      })
      toast.success(`${kind} rate updated`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Save failed')
    } finally {
      setSavingRate(null)
    }
  }

  const handleSaveAgent = async () => {
    if (!accessToken || !params.id || savingAgent) return
    setSavingAgent(true)
    try {
      if (!agentUserId) {
        await apiRequest(`/api/v1/merchants/${params.id}/agent`, {
          method: 'POST',
          token: accessToken,
          body: { agent_user_id: null },
        })
        toast.success(`${agentLabel()} cleared`)
      } else {
        await apiRequest(`/api/v1/merchants/${params.id}/agent`, {
          method: 'POST',
          token: accessToken,
          body: {
            agent_user_id: agentUserId,
            rates: [
              { rate_kind: 'PAYIN', rate_bp: agentPayinBp },
              { rate_kind: 'PAYOUT', rate_bp: agentPayoutBp },
            ],
          },
        })
        toast.success(`${agentLabel()} assigned`)
      }
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not save Agent')
    } finally {
      setSavingAgent(false)
    }
  }

  const handleSupagoConnect = async () => {
    const trimmedUsername = supagoUsername.trim()
    const trimmedPassword = supagoPassword.trim()
    const trimmedTransactionCode = supagoTransactionCode.trim()
    if (!accessToken || !params.id || !trimmedUsername || !trimmedPassword || !trimmedTransactionCode) return
    setSupagoLoading(true)
    setSupagoError(null)
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${params.id}/supago`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          supago_username: trimmedUsername,
          supago_password: trimmedPassword,
          supago_transaction_code: trimmedTransactionCode,
        },
      })
      setSupagoStatus(status)
      setSupagoUsername('')
      setSupagoPassword('')
      setSupagoTransactionCode(status.transaction_code ?? trimmedTransactionCode)
      setUpdateCredsOpen(false)
      toast.success(updateCredsOpen ? 'Supago credentials updated' : 'Supago connected')
      await load()
    } catch (caught) {
      setSupagoError(caught instanceof ApiClientError ? caught.message : 'Connection failed')
    } finally {
      setSupagoLoading(false)
    }
  }

  const handleSupagoDisconnect = async () => {
    if (!accessToken || !params.id) return
    setSupagoLoading(true)
    setSupagoError(null)
    setConfirmDisconnect(false)
    try {
      const status = await apiRequest<SupagoStatus>(`/api/v1/merchants/${params.id}/supago`, {
        method: 'DELETE',
        token: accessToken,
      })
      setSupagoStatus(status)
      toast.success('Supago credentials cleared. Panel stays locked to Supago.')
      await load()
    } catch (caught) {
      setSupagoError(caught instanceof ApiClientError ? caught.message : 'Disconnect failed')
    } finally {
      setSupagoLoading(false)
    }
  }

  const handleCriciConnect = async () => {
    const trimmedUsername = criciUsername.trim()
    const trimmedPassword = criciPassword.trim()
    const trimmedTotp = criciTotpCode.trim()
    if (!accessToken || !params.id || !trimmedUsername || !trimmedPassword) return
    if (criciStatus?.requires_2fa && !/^\d{6}$/.test(trimmedTotp)) {
      setCriciError('Enter the 6-digit Google Authenticator code')
      return
    }
    setCriciLoading(true)
    setCriciError(null)
    try {
      const status = await apiRequest<CriciStatus>(`/api/v1/merchants/${params.id}/crici`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          crici_username: trimmedUsername,
          crici_password: trimmedPassword,
          ...(trimmedTotp ? { crici_totp_code: trimmedTotp } : {}),
        },
      })
      setCriciStatus(status)
      setCriciUsername('')
      setCriciPassword('')
      setCriciTotpCode('')
      setCriciUpdateOpen(false)
      toast.success(criciUpdateOpen ? 'Crici credentials updated' : 'Crici connected')
      await load()
    } catch (caught) {
      setCriciError(caught instanceof ApiClientError ? caught.message : 'Connection failed')
      if (caught instanceof ApiClientError && /authenticator|2fa/i.test(caught.message)) {
        setCriciStatus((prev) =>
          prev
            ? { ...prev, requires_2fa: true, needs_reconnect: true, connected: false, last_error: caught.message }
            : {
                connected: false,
                requires_2fa: true,
                needs_reconnect: true,
                last_error: caught.message,
              },
        )
      }
    } finally {
      setCriciLoading(false)
    }
  }

  const handleCriciDisconnect = async () => {
    if (!accessToken || !params.id) return
    setCriciLoading(true)
    setCriciError(null)
    setConfirmCriciDisconnect(false)
    try {
      const status = await apiRequest<CriciStatus>(`/api/v1/merchants/${params.id}/crici`, {
        method: 'DELETE',
        token: accessToken,
      })
      setCriciStatus(status)
      toast.success('Crici credentials cleared. Panel stays locked to Crici.')
      await load()
    } catch (caught) {
      setCriciError(caught instanceof ApiClientError ? caught.message : 'Disconnect failed')
    } finally {
      setCriciLoading(false)
    }
  }

  const handleSaveRouting = async () => {
    if (!accessToken || !params.id || savingRouting) return
    if (routingMode === 'direct' && !routingAdminId) {
      toast.error(`Select a ${bankerLabel()} for direct assign`)
      return
    }
    setSavingRouting(true)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}/payout-routing`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          default_payout_banker_user_id: routingMode === 'direct' ? routingAdminId : null,
        },
      })
      setMerchant(detail)
      applyRoutingFromDetail(detail)
      toast.success('Withdraw routing updated')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not save routing')
    } finally {
      setSavingRouting(false)
    }
  }

  const handleToggleBankAdmin = (adminId: string) => {
    setBankAdminIds((prev) =>
      prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId],
    )
  }

  const handleSaveBankAdmins = async () => {
    if (!accessToken || !params.id || savingBankAdmins) return
    if (bankAdminMode === 'SELECTED' && bankAdminIds.length === 0) {
      toast.error(`Select at least one ${bankerLabel()}, or choose All ${bankerLabel({ plural: true })}.`)
      return
    }
    setSavingBankAdmins(true)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/bank-admins`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          bank_banker_mode: bankAdminMode,
          banker_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
        },
      })
      toast.success('Deposit managers saved')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not save deposit managers')
    } finally {
      setSavingBankAdmins(false)
    }
  }

  const handleMerchantStatus = async () => {
    if (!accessToken || !params.id || !statusConfirm || statusSubmitting) return
    setStatusSubmitting(true)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/status`, {
        method: 'POST',
        token: accessToken,
        body: { status: statusConfirm },
      })
      setStatusConfirm(null)
      if (statusConfirm === 'SUSPENDED') {
        toast.success(`${merchantLabel()} suspended. Synced banks disabled; reconnect panel after Activate.`)
      } else {
        toast.success(`${merchantLabel()} activated. Reconnect panel credentials; re-enable banks from Bank Details.`)
      }
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update status')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const handlePortalEnable = async () => {
    if (!accessToken || !params.id || !portalPassword.trim() || portalBusy) return
    setPortalBusy(true)
    try {
      const result = await apiRequest<{
        user_id: string
        username: string
        temporary_password: string
      }>(`/api/v1/merchants/${params.id}/portal/enable`, {
        method: 'POST',
        token: accessToken,
        body: { temporary_password: portalPassword },
      })
      setPortalOncePassword(result.temporary_password)
      setPortalPassword('')
      toast.success(`Portal enabled. Username: ${result.username}`)
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not enable portal')
    } finally {
      setPortalBusy(false)
    }
  }

  const handlePortalDisable = async () => {
    if (!accessToken || !params.id || portalBusy) return
    setPortalBusy(true)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/portal/disable`, {
        method: 'POST',
        token: accessToken,
      })
      setPortalDisableConfirm(false)
      setPortalOncePassword(null)
      toast.success('Portal access disabled')
      await load()
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not disable portal')
    } finally {
      setPortalBusy(false)
    }
  }

  const canEdit = hasMenu(menus, 'MERCHANTS', 'can_edit')
  const canEditRouting = Boolean(isSuperAdmin && canEdit)
  const canEditBankAdmins = Boolean(isSuperAdmin && canEdit)
  const activeAdmins = admins.filter((row) => row.role === 'BANKER' && row.status === 'ACTIVE')
  const lockedPanel: PanelIntegrationType =
    merchant?.integration_type === 'SUPAGO'
      ? 'supago'
      : merchant?.integration_type === 'CRICI'
        ? 'crici'
        : 'none'
  const connectedPanel: PanelIntegrationType =
    lockedPanel !== 'none'
      ? lockedPanel
      : supagoStatus?.connected
        ? 'supago'
        : criciStatus?.connected
          ? 'crici'
          : 'none'
  const panelSelectValue = connectedPanel !== 'none' ? connectedPanel : panelChoice
  const panelBusy = supagoLoading || criciLoading
  const panelError =
    panelSelectValue === 'supago' ? supagoError : panelSelectValue === 'crici' ? criciError : null

  const handlePanelChoiceChange = (next: PanelIntegrationType) => {
    if (lockedPanel !== 'none') return
    setPanelChoice(next)
    setSupagoError(null)
    setCriciError(null)
    setUpdateCredsOpen(false)
    setCriciUpdateOpen(false)
    if (next !== 'supago') {
      setSupagoUsername('')
      setSupagoPassword('')
      setSupagoTransactionCode('')
    }
    if (next !== 'crici') {
      setCriciUsername('')
      setCriciPassword('')
      setCriciTotpCode('')
    }
  }

  return (
    <AppShell title={`${merchantLabel()} Detail`} role={user.role} menus={menus}>
      <PageHeader
        title={merchant?.display_name ?? `${merchantLabel()} Detail`}
        {...(merchant ? { subtitle: `${merchant.merchant_code} · ${merchant.legal_name}` } : {})}
        backHref="/merchants"
        backLabel={merchantLabel({ plural: true })}
      />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <FormShell wide compact>
          <FormSection title={merchantLabel()}>
            <FormGrid>
              <FormField label="Legal Name">
                <Input value={merchant.legal_name} readOnly />
              </FormField>
              <FormField label={`${merchantLabel()} Code`}>
                <Input value={merchant.merchant_code} readOnly />
              </FormField>
              <FormField label="Contact Email">
                <Input value={merchant.contact_email ?? '—'} readOnly />
              </FormField>
              {merchant.contact_mobile ? (
                <FormField label="Contact Mobile">
                  <Input value={merchant.contact_mobile} readOnly />
                </FormField>
              ) : null}
            </FormGrid>
            <div
              className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--qp-border)', backgroundColor: '#f8fafc' }}
              aria-label={`${merchantLabel()} status`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
                Status
              </span>
              <StatusBadge status={merchant.status} />
              {canEdit && merchant.status === 'ACTIVE' ? (
                <PrimaryButton onClick={() => setStatusConfirm('SUSPENDED')}>Suspend</PrimaryButton>
              ) : null}
              {canEdit && merchant.status === 'SUSPENDED' ? (
                <PrimaryButton onClick={() => setStatusConfirm('ACTIVE')}>Activate</PrimaryButton>
              ) : null}
              {merchant.status === 'SUSPENDED' ? (
                <span className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                  Reconnect panel credentials after Activate; re-enable banks from Bank Details.
                </span>
              ) : null}
              {supagoStatus?.connected ? (
                <span
                  className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: 'var(--qp-success-bg)', color: 'var(--qp-success)', border: '1px solid var(--qp-success-border)' }}
                >
                  Supago connected
                </span>
              ) : criciStatus?.connected ? (
                <span
                  className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: 'var(--qp-success-bg)', color: 'var(--qp-success)', border: '1px solid var(--qp-success-border)' }}
                >
                  Crici connected
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                  style={{ backgroundColor: '#fff', color: 'var(--qp-text-muted)', border: '1px solid var(--qp-border)' }}
                >
                  Panel off
                </span>
              )}
            </div>
          </FormSection>

          {canEdit ? (
            <FormSection
              title="Portal access"
              description="One Exchange Master login (username = merchant code). View-only Dashboard, Pay-In, Pay-Out, and Transactions."
            >
              {merchant.portal_user_id && merchant.portal_user_status === 'ACTIVE' ? (
                <div className="space-y-3">
                  <FormGrid>
                    <FormField label="Portal username">
                      <Input value={merchant.portal_username ?? merchant.merchant_code} readOnly />
                    </FormField>
                    <FormField label="Portal status">
                      <div className="flex h-10 items-center px-3">
                        <StatusBadge status={merchant.portal_user_status} />
                      </div>
                    </FormField>
                  </FormGrid>
                  {portalOncePassword ? (
                    <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--qp-border)' }}>
                      Temporary password (shown once): <strong className="font-mono">{portalOncePassword}</strong>
                    </p>
                  ) : null}
                  <PrimaryButton onClick={() => setPortalDisableConfirm(true)} disabled={portalBusy}>
                    Disable portal
                  </PrimaryButton>
                </div>
              ) : merchant.portal_user_id && merchant.portal_user_status === 'DISABLED' ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
                    Portal user <span className="font-mono">{merchant.portal_username}</span> is disabled.
                    Set a temporary password to re-enable (merchant must be ACTIVE).
                  </p>
                  {merchant.status === 'ACTIVE' ? (
                    <>
                      <FormField label="Temporary password" required>
                        <Input
                          type="password"
                          value={portalPassword}
                          onChange={(event) => setPortalPassword(event.target.value)}
                          autoComplete="new-password"
                          aria-label="Temporary portal password"
                        />
                      </FormField>
                      <PrimaryButton onClick={() => void handlePortalEnable()} disabled={portalBusy || !portalPassword.trim()}>
                        Re-enable portal
                      </PrimaryButton>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
                      Activate this {merchantLabel()} before re-enabling portal login.
                    </p>
                  )}
                </div>
              ) : merchant.status !== 'ACTIVE' ? (
                <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
                  Activate this {merchantLabel()} before enabling portal login.
                </p>
              ) : (
                <div className="space-y-3">
                  <FormField label="Temporary password" required>
                    <Input
                      type="password"
                      value={portalPassword}
                      onChange={(event) => setPortalPassword(event.target.value)}
                      autoComplete="new-password"
                      aria-label="Temporary portal password"
                    />
                  </FormField>
                  <PrimaryButton onClick={() => void handlePortalEnable()} disabled={portalBusy || !portalPassword.trim()}>
                    Enable portal
                  </PrimaryButton>
                </div>
              )}
            </FormSection>
          ) : null}

          {canEdit ? (
            <FormSection title="Rates">
              <FormGrid>
                <FormField label="PAY-IN">
                  <div className="flex items-center gap-2">
                    <RateInput id="edit-payin" valueBp={payinBp} onChangeBp={setPayinBp} />
                    <PrimaryButton disabled={savingRate === 'PAYIN'} onClick={() => void handleSaveKind('PAYIN')}>
                      {savingRate === 'PAYIN' ? 'Saving…' : 'Update'}
                    </PrimaryButton>
                  </div>
                </FormField>
                <FormField label="PAY-OUT">
                  <div className="flex items-center gap-2">
                    <RateInput id="edit-payout" valueBp={payoutBp} onChangeBp={setPayoutBp} />
                    <PrimaryButton disabled={savingRate === 'PAYOUT'} onClick={() => void handleSaveKind('PAYOUT')}>
                      {savingRate === 'PAYOUT' ? 'Saving…' : 'Update'}
                    </PrimaryButton>
                  </div>
                </FormField>
              </FormGrid>
            </FormSection>
          ) : null}

          {canEdit ? (
            <FormSection
              title={agentLabel()}
              description="Upper-line brokerage carved from Exchange commission. Banker rates must stay ≤ Exchange − Agent."
            >
              <FormGrid>
                <FormField label={agentLabel()}>
                  <Select
                    id="merchant-agent"
                    value={agentUserId}
                    onChange={(event) => setAgentUserId(event.target.value)}
                    aria-label={agentLabel()}
                  >
                    <option value="">None</option>
                    {agentOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.username}
                      </option>
                    ))}
                    {agentUserId && !agentOptions.some((o) => o.id === agentUserId) && merchant?.agent_username ? (
                      <option value={agentUserId}>{merchant.agent_username}</option>
                    ) : null}
                  </Select>
                </FormField>
                {agentUserId ? (
                  <>
                    <FormField label="Agent PAY-IN brokerage">
                      <RateInput id="agent-payin" valueBp={agentPayinBp} onChangeBp={setAgentPayinBp} />
                    </FormField>
                    <FormField label="Agent PAY-OUT brokerage">
                      <RateInput id="agent-payout" valueBp={agentPayoutBp} onChangeBp={setAgentPayoutBp} />
                    </FormField>
                    <FormField label="Residual ceiling (PAY-IN)">
                      <p className="text-sm text-zinc-600">
                        Exchange {payinBp} bp − Agent {agentPayinBp} bp ={' '}
                        <strong>{Math.max(0, payinBp - agentPayinBp)} bp</strong> max for Bankers
                      </p>
                    </FormField>
                  </>
                ) : null}
              </FormGrid>
              <div className="mt-3">
                <PrimaryButton disabled={savingAgent} onClick={() => void handleSaveAgent()}>
                  {savingAgent ? 'Saving…' : `Save ${agentLabel()}`}
                </PrimaryButton>
              </div>
            </FormSection>
          ) : null}

          {canEditRouting ? (
            <FormSection title="Withdraw routing" description="Applies to new panel withdraw polls only.">
              <FormGrid>
                <FormField label="Routing" required>
                  <Select
                    id="withdraw-routing-mode"
                    value={routingMode}
                    onChange={(event) => {
                      const next = event.target.value as WithdrawRoutingMode
                      setRoutingMode(next)
                      if (next === 'queue') setRoutingAdminId('')
                    }}
                    aria-label="Withdraw routing mode"
                  >
                    <option value="queue">Super Admin queue (assign later)</option>
                    <option value="direct">Direct to {bankerLabel()}</option>
                  </Select>
                </FormField>
                {routingMode === 'direct' ? (
                  <FormField label={bankerLabel()} required>
                    <Select
                      id="withdraw-routing-admin"
                      value={routingAdminId}
                      onChange={(event) => setRoutingAdminId(event.target.value)}
                      aria-label={`Default payout ${bankerLabel()}`}
                    >
                      <option value="">Select {bankerLabel()}</option>
                      {activeAdmins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.username}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Current">
                    <Input value="Unassigned until Super Admin bulk-assigns" readOnly />
                  </FormField>
                )}
              </FormGrid>
              <div className="mt-3 flex justify-end">
                <PrimaryButton
                  type="button"
                  disabled={savingRouting || (routingMode === 'direct' && !routingAdminId)}
                  onClick={() => void handleSaveRouting()}
                >
                  {savingRouting ? 'Saving…' : 'Save routing'}
                </PrimaryButton>
              </div>
            </FormSection>
          ) : merchant.default_payout_banker_user_id ? (
            <FormSection title="Withdraw routing">
              <FormField label={`Direct ${bankerLabel()}`}>
                <Input
                  value={merchant.default_payout_banker_username ?? merchant.default_payout_banker_user_id}
                  readOnly
                />
              </FormField>
            </FormSection>
          ) : null}

          {canEditBankAdmins ? (
            <>
              <BankAdminsFormSection
                compact
                mode={bankAdminMode}
                selectedIds={bankAdminIds}
                admins={activeAdmins}
                onModeChange={setBankAdminMode}
                onToggleAdmin={handleToggleBankAdmin}
                disabled={savingBankAdmins}
              />
              <div className="-mt-1 flex justify-end">
                <PrimaryButton
                  type="button"
                  disabled={savingBankAdmins || (bankAdminMode === 'SELECTED' && bankAdminIds.length === 0)}
                  onClick={() => void handleSaveBankAdmins()}
                >
                  {savingBankAdmins ? 'Saving…' : 'Save'}
                </PrimaryButton>
              </div>
            </>
          ) : null}

          <FormSection
            title="Panel integration"
            description="One external panel per exchange master. The first connect locks the panel permanently; credentials can be changed or cleared later."
          >
            {panelError ? (
              <div className="mb-3">
                <ErrorAlert message={panelError} />
              </div>
            ) : null}

            <FormGrid>
              <FormField label="Integration">
                <Select
                  id="panel-integration-type"
                  value={panelSelectValue}
                  disabled={!canEdit || lockedPanel !== 'none' || panelBusy}
                  onChange={(event) => handlePanelChoiceChange(event.target.value as PanelIntegrationType)}
                  aria-label="Panel integration type"
                >
                  <option value="none">None</option>
                  <option value="supago">Supago</option>
                  <option value="crici">Crici</option>
                </Select>
              </FormField>
            </FormGrid>
            {lockedPanel !== 'none' ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                Panel is locked to {lockedPanel === 'supago' ? 'Supago' : 'Crici'}. You can change or clear
                credentials for this panel only — switching panels is not allowed.
              </p>
            ) : null}

            {connectedPanel === 'supago' || (connectedPanel === 'none' && panelChoice === 'supago') ? (
              <div className="mt-4">
                {supagoStatus?.connected ? (
                  <>
                    <FormGrid>
                      <FormField label="Username">
                        <Input value={supagoStatus.uname ?? ''} readOnly />
                      </FormField>
                      <FormField label="Branch Code">
                        <Input value={supagoStatus.bcode ?? ''} readOnly />
                      </FormField>
                      <FormField label="Token Expires">
                        <Input
                          value={
                            supagoStatus.expires_at ? new Date(supagoStatus.expires_at).toLocaleString() : ''
                          }
                          readOnly
                        />
                      </FormField>
                      <FormField label="Transaction Code">
                        <Input value={supagoStatus.transaction_code ?? ''} readOnly />
                      </FormField>
                    </FormGrid>

                    {canEdit ? (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setUpdateCredsOpen((open) => !open)
                            setSupagoUsername('')
                            setSupagoPassword('')
                            setSupagoTransactionCode(supagoStatus.transaction_code ?? '')
                            setSupagoError(null)
                          }}
                          disabled={panelBusy}
                          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            borderColor: 'var(--qp-border)',
                            color: 'var(--qp-text-secondary)',
                            backgroundColor: '#fff',
                          }}
                        >
                          {updateCredsOpen ? 'Cancel' : 'Change credentials'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDisconnect(true)}
                          disabled={panelBusy}
                          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            borderColor: 'var(--qp-danger)',
                            color: 'var(--qp-danger)',
                            backgroundColor: 'var(--qp-danger-bg)',
                          }}
                        >
                          Clear credentials
                        </button>
                      </div>
                    ) : null}

                    {canEdit && updateCredsOpen ? (
                      <div
                        className="mt-3 rounded-lg border p-3"
                        style={{ borderColor: 'var(--qp-border)', backgroundColor: '#f8fafc' }}
                      >
                        <FormGrid>
                          <FormField label="Username" required>
                            <Input
                              value={supagoUsername}
                              onChange={(e) => setSupagoUsername(e.target.value)}
                              placeholder="New Supago username"
                              aria-label="Supago username"
                            />
                          </FormField>
                          <FormField label="Password" required>
                            <Input
                              type="password"
                              value={supagoPassword}
                              onChange={(e) => setSupagoPassword(e.target.value)}
                              placeholder="New Supago password"
                              aria-label="Supago password"
                            />
                          </FormField>
                          <FormField label="Transaction Code" required>
                            <Input
                              value={supagoTransactionCode}
                              onChange={(e) => setSupagoTransactionCode(e.target.value)}
                              placeholder="e.g. 643795"
                              aria-label="Supago transaction code"
                            />
                          </FormField>
                        </FormGrid>
                        <div className="mt-3 flex justify-end">
                          <PrimaryButton
                            onClick={() => void handleSupagoConnect()}
                            disabled={
                              panelBusy ||
                              !supagoUsername.trim() ||
                              !supagoPassword.trim() ||
                              !supagoTransactionCode.trim()
                            }
                          >
                            {supagoLoading ? 'Saving…' : 'Save'}
                          </PrimaryButton>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : canEdit ? (
                  <>
                    {lockedPanel === 'supago' ? (
                      <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                        Credentials cleared. Reconnect Supago to resume panel sync.
                      </p>
                    ) : null}
                    <FormGrid>
                      <FormField label="Supago Username" required>
                        <Input
                          value={supagoUsername}
                          onChange={(e) => setSupagoUsername(e.target.value)}
                          placeholder="Enter Supago username"
                          aria-label="Supago username"
                        />
                      </FormField>
                      <FormField label="Supago Password" required>
                        <Input
                          type="password"
                          value={supagoPassword}
                          onChange={(e) => setSupagoPassword(e.target.value)}
                          placeholder="Enter Supago password"
                          aria-label="Supago password"
                        />
                      </FormField>
                      <FormField label="Transaction Code" required>
                        <Input
                          value={supagoTransactionCode}
                          onChange={(e) => setSupagoTransactionCode(e.target.value)}
                          placeholder="e.g. 643795"
                          aria-label="Supago transaction code"
                        />
                      </FormField>
                    </FormGrid>
                    <div className="mt-3 flex justify-end">
                      <PrimaryButton
                        onClick={() => void handleSupagoConnect()}
                        disabled={
                          panelBusy ||
                          !supagoUsername.trim() ||
                          !supagoPassword.trim() ||
                          !supagoTransactionCode.trim()
                        }
                      >
                        {supagoLoading ? 'Connecting…' : lockedPanel === 'supago' ? 'Reconnect' : 'Connect'}
                      </PrimaryButton>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                    Not connected
                  </p>
                )}
              </div>
            ) : null}

            {connectedPanel === 'crici' || (connectedPanel === 'none' && panelChoice === 'crici') ? (
              <div className="mt-4">
                {criciStatus?.connected ? (
                  <>
                    <FormGrid>
                      <FormField label="Username">
                        <Input value={criciStatus.username ?? ''} readOnly />
                      </FormField>
                      <FormField label="Session Expires">
                        <Input
                          value={
                            criciStatus.expires_at ? new Date(criciStatus.expires_at).toLocaleString() : ''
                          }
                          readOnly
                        />
                      </FormField>
                    </FormGrid>
                    {criciStatus.last_error ? (
                      <p className="mt-2 text-xs" style={{ color: 'var(--qp-danger)' }}>
                        {criciStatus.last_error}
                      </p>
                    ) : null}

                    {canEdit ? (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCriciUpdateOpen((open) => !open)
                            setCriciUsername('')
                            setCriciPassword('')
                            setCriciTotpCode('')
                            setCriciError(null)
                          }}
                          disabled={panelBusy}
                          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            borderColor: 'var(--qp-border)',
                            color: 'var(--qp-text-secondary)',
                            backgroundColor: '#fff',
                          }}
                        >
                          {criciUpdateOpen ? 'Cancel' : 'Change credentials'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCriciDisconnect(true)}
                          disabled={panelBusy}
                          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            borderColor: 'var(--qp-danger)',
                            color: 'var(--qp-danger)',
                            backgroundColor: 'var(--qp-danger-bg)',
                          }}
                        >
                          Clear credentials
                        </button>
                      </div>
                    ) : null}

                    {canEdit && criciUpdateOpen ? (
                      <div
                        className="mt-3 rounded-lg border p-3"
                        style={{ borderColor: 'var(--qp-border)', backgroundColor: '#f8fafc' }}
                      >
                        <FormGrid>
                          <FormField label="Username" required>
                            <Input
                              value={criciUsername}
                              onChange={(e) => setCriciUsername(e.target.value)}
                              placeholder="New Crici username"
                              aria-label="Crici username"
                              autoComplete="off"
                            />
                          </FormField>
                          <FormField label="Password" required>
                            <Input
                              type="password"
                              value={criciPassword}
                              onChange={(e) => setCriciPassword(e.target.value)}
                              placeholder="New Crici password"
                              aria-label="Crici password"
                              autoComplete="new-password"
                            />
                          </FormField>
                          <FormField label="Authenticator code">
                            <Input
                              value={criciTotpCode}
                              onChange={(e) => setCriciTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit code if 2FA enabled"
                              aria-label="Crici Google Authenticator code"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </FormField>
                        </FormGrid>
                        <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                          Password is write-only. If this Crici account uses Google Authenticator, enter a fresh code.
                        </p>
                        <div className="mt-3 flex justify-end">
                          <PrimaryButton
                            onClick={() => void handleCriciConnect()}
                            disabled={panelBusy || !criciUsername.trim() || !criciPassword.trim()}
                          >
                            {criciLoading ? 'Saving…' : 'Save'}
                          </PrimaryButton>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : canEdit ? (
                  <>
                    {lockedPanel === 'crici' ? (
                      <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                        {criciStatus?.requires_2fa || criciStatus?.needs_reconnect
                          ? 'Crici session needs reconnect. Enter username, password, and a fresh Google Authenticator code.'
                          : 'Credentials cleared. Reconnect Crici to resume panel sync.'}
                      </p>
                    ) : null}
                    {criciStatus?.last_error ? (
                      <p className="mb-3 text-xs" style={{ color: 'var(--qp-danger)' }}>
                        {criciStatus.last_error}
                      </p>
                    ) : null}
                    <FormGrid>
                      <FormField label="Crici Username" required>
                        <Input
                          value={criciUsername}
                          onChange={(e) => setCriciUsername(e.target.value)}
                          placeholder="Enter Crici username"
                          aria-label="Crici username"
                          autoComplete="off"
                        />
                      </FormField>
                      <FormField label="Crici Password" required>
                        <Input
                          type="password"
                          value={criciPassword}
                          onChange={(e) => setCriciPassword(e.target.value)}
                          placeholder="Enter Crici password"
                          aria-label="Crici password"
                          autoComplete="new-password"
                        />
                      </FormField>
                      <FormField
                        label="Authenticator code"
                        required={Boolean(criciStatus?.requires_2fa)}
                      >
                        <Input
                          value={criciTotpCode}
                          onChange={(e) => setCriciTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit Google Authenticator code"
                          aria-label="Crici Google Authenticator code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                      </FormField>
                    </FormGrid>
                    <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      Password is write-only after connect. Codes are not stored — you must paste a new code on each reconnect when 2FA is enabled.
                    </p>
                    <div className="mt-3 flex justify-end">
                      <PrimaryButton
                        onClick={() => void handleCriciConnect()}
                        disabled={
                          panelBusy ||
                          !criciUsername.trim() ||
                          !criciPassword.trim() ||
                          (Boolean(criciStatus?.requires_2fa) && !/^\d{6}$/.test(criciTotpCode.trim()))
                        }
                      >
                        {criciLoading ? 'Connecting…' : lockedPanel === 'crici' ? 'Reconnect' : 'Connect'}
                      </PrimaryButton>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                    Not connected
                  </p>
                )}
              </div>
            ) : null}

            {connectedPanel === 'none' && panelChoice === 'none' ? (
              <p className="mt-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                No panel selected. Choose Supago or Crici to connect credentials.
              </p>
            ) : null}
          </FormSection>

          <FormSection title="Rate history">
            <DataTable
              columns={[
                { key: 'kind', heading: 'KIND' },
                { key: 'rate', heading: 'RATE' },
                { key: 'from', heading: 'EFFECTIVE FROM' },
              ]}
              rows={history.map((row) => ({
                kind: row.rate_kind,
                rate: <RateDisplay rateBp={row.rate_bp} />,
                from: new Date(row.effective_from).toLocaleString(),
              }))}
              empty={<EmptyState message="No rate history" />}
            />
          </FormSection>
        </FormShell>
      )}

      {confirmDisconnect ? (
        <ConfirmDialog
          title="Clear Supago credentials?"
          subtitle="The cached token will be evicted and credentials removed. This merchant stays locked to Supago — you can reconnect the same panel, but cannot switch to Crici."
          confirmLabel="Clear credentials"
          variant="danger"
          loading={supagoLoading}
          onConfirm={() => void handleSupagoDisconnect()}
          onCancel={() => setConfirmDisconnect(false)}
        />
      ) : null}

      {confirmCriciDisconnect ? (
        <ConfirmDialog
          title="Clear Crici credentials?"
          subtitle="The cached session will be cleared and credentials removed. This merchant stays locked to Crici — you can reconnect the same panel, but cannot switch to Supago."
          confirmLabel="Clear credentials"
          variant="danger"
          loading={criciLoading}
          onConfirm={() => void handleCriciDisconnect()}
          onCancel={() => setConfirmCriciDisconnect(false)}
        />
      ) : null}

      {statusConfirm === 'SUSPENDED' ? (
        <ConfirmDialog
          title={`Suspend ${merchant?.legal_name ?? 'merchant'}?`}
          subtitle="All banks synced with this merchant will be disabled (panel + CRM). Panel credentials are cleared. Polls stop until you Activate and reconnect."
          confirmLabel="Suspend"
          loading={statusSubmitting}
          onConfirm={() => void handleMerchantStatus()}
          onCancel={() => setStatusConfirm(null)}
        />
      ) : null}

      {statusConfirm === 'ACTIVE' ? (
        <ConfirmDialog
          title={`Activate ${merchant?.legal_name ?? 'merchant'}?`}
          subtitle="Sets the merchant ACTIVE only. Reconnect panel credentials here, then re-enable banks from Bank Details. Banks are not restored automatically."
          confirmLabel="Activate"
          variant="primary"
          loading={statusSubmitting}
          onConfirm={() => void handleMerchantStatus()}
          onCancel={() => setStatusConfirm(null)}
        />
      ) : null}

      {portalDisableConfirm ? (
        <ConfirmDialog
          title="Disable portal access?"
          subtitle="The Exchange Master login will be DISABLED and all sessions revoked. You can re-enable later with a new temporary password."
          confirmLabel="Disable portal"
          variant="danger"
          loading={portalBusy}
          onConfirm={() => void handlePortalDisable()}
          onCancel={() => setPortalDisableConfirm(false)}
        />
      ) : null}
    </AppShell>
  )
}
