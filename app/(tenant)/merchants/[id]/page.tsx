'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type {
  BankAdminMode,
  GatewayConfigView,
  GatewaySecretReveal,
  MerchantDetail,
  MerchantRate,
  PayoutBankerMode,
} from '@quickerpay/shared-types'
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
import { PayoutBankersFormSection } from '@/components/forms/PayoutBankersFormSection'
import { GatewayIntegrationSection } from '@/components/forms/GatewayIntegrationSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { CopyButton } from '@/components/ui/CopyButton'
import { toast } from 'sonner'
import { Settings } from 'lucide-react'
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
  const [savingPrimary, setSavingPrimary] = useState(false)
  const [routingMode, setRoutingMode] = useState<WithdrawRoutingMode>('queue')
  const [routingAdminId, setRoutingAdminId] = useState('')
  const [payoutBankerMode, setPayoutBankerMode] = useState<PayoutBankerMode>('ALL')
  const [payoutBankerIds, setPayoutBankerIds] = useState<string[]>([])
  const [savingRouting, setSavingRouting] = useState(false)
  const [bankAdminMode, setBankAdminMode] = useState<BankAdminMode>('ALL')
  const [bankAdminIds, setBankAdminIds] = useState<string[]>([])
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
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfigView | null>(null)
  const [webhookUrlDraft, setWebhookUrlDraft] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [secretRegenConfirm, setSecretRegenConfirm] = useState(false)
  const [secretRegenBusy, setSecretRegenBusy] = useState(false)
  const [keyRotateConfirm, setKeyRotateConfirm] = useState(false)
  const [keyRotateBusy, setKeyRotateBusy] = useState(false)
  const [secretReveal, setSecretReveal] = useState<GatewaySecretReveal | null>(null)

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
    setPayoutBankerMode(detail.payout_banker_mode ?? 'ALL')
    setPayoutBankerIds(detail.payout_banker_user_ids ?? [])
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

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!accessToken || !params.id) return
    if (!options?.silent) setLoading(true)
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
        const gw = await apiRequest<GatewayConfigView>(`/api/v1/merchants/${params.id}/gateway`, {
          token: accessToken,
        })
        setGatewayConfig(gw)
        setWebhookUrlDraft(gw.webhook_url ?? '')
      } catch {
        setGatewayConfig(null)
        setWebhookUrlDraft('')
      }
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

  const canEdit = hasMenu(menus, 'MERCHANTS', 'can_edit')
  const canEditRouting = Boolean(isSuperAdmin && canEdit)
  const canEditBankAdmins = Boolean(isSuperAdmin && canEdit)

  const handlePrimaryUpdate = async () => {
    if (!accessToken || !params.id || savingPrimary) return
    if (canEditBankAdmins && bankAdminMode === 'SELECTED' && bankAdminIds.length === 0) {
      toast.error(`Select at least one ${bankerLabel()}, or choose All ${bankerLabel({ plural: true })}.`)
      return
    }
    setSavingPrimary(true)
    setError(null)
    try {
      if (canEdit) {
        await apiRequest(`/api/v1/merchants/${params.id}/rates`, {
          method: 'POST',
          token: accessToken,
          body: { rate_kind: 'PAYIN', rate_bp: payinBp },
        })
        await apiRequest(`/api/v1/merchants/${params.id}/rates`, {
          method: 'POST',
          token: accessToken,
          body: { rate_kind: 'PAYOUT', rate_bp: payoutBp },
        })
      }
      if (canEditBankAdmins) {
        await apiRequest(`/api/v1/merchants/${params.id}/bank-admins`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            bank_banker_mode: bankAdminMode,
            banker_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
          },
        })
      }
      if (isSuperAdmin && canEdit && gatewayConfig?.enabled) {
        await apiRequest(`/api/v1/merchants/${params.id}/gateway`, {
          method: 'PATCH',
          token: accessToken,
          body: { webhook_url: webhookUrlDraft.trim() },
        })
      }
      toast.success('Updated')
      await load({ silent: true })
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not update'
      setError(message)
      toast.error(message)
    } finally {
      setSavingPrimary(false)
    }
  }

  const handleRegenerateWebhookSecret = async () => {
    if (!accessToken || !params.id || secretRegenBusy || !gatewayConfig?.enabled) return
    setSecretRegenBusy(true)
    try {
      const revealed = await apiRequest<GatewaySecretReveal>(
        `/api/v1/merchants/${params.id}/gateway/webhook-secret`,
        { method: 'POST', token: accessToken },
      )
      setSecretRegenConfirm(false)
      setSecretReveal(revealed)
      toast.success('Webhook secret regenerated')
      await load({ silent: true })
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not regenerate webhook secret',
      )
    } finally {
      setSecretRegenBusy(false)
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
    if (payoutBankerMode === 'SELECTED' && payoutBankerIds.length === 0) {
      toast.error(`Select at least one ${bankerLabel()}, or choose All ${bankerLabel({ plural: true })}.`)
      return
    }
    if (routingMode === 'direct' && !routingAdminId) {
      toast.error(`Select a ${bankerLabel()} for direct assign`)
      return
    }
    if (
      payoutBankerMode === 'SELECTED' &&
      routingMode === 'direct' &&
      routingAdminId &&
      !payoutBankerIds.includes(routingAdminId)
    ) {
      toast.error(`Default payout ${bankerLabel()} must be in the Selected ${bankerLabel({ plural: true })} allowlist.`)
      return
    }
    setSavingRouting(true)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}/payout-routing`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          payout_banker_mode: payoutBankerMode,
          banker_user_ids: payoutBankerMode === 'SELECTED' ? payoutBankerIds : [],
          default_payout_banker_user_id: routingMode === 'direct' ? routingAdminId : null,
        },
      })
      setMerchant(detail)
      applyRoutingFromDetail(detail)
      toast.success('Withdrawal routing updated')
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not save routing')
    } finally {
      setSavingRouting(false)
    }
  }

  const handleTogglePayoutAdmin = (adminId: string) => {
    setPayoutBankerIds((prev) =>
      prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId],
    )
  }

  const handleToggleBankAdmin = (adminId: string) => {
    setBankAdminIds((prev) =>
      prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId],
    )
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

  const handlePortalResetPassword = async () => {
    const portalUserId = merchant?.portal_user_id
    const temp = portalPassword.trim()
    if (!accessToken || !portalUserId || !temp || portalBusy) return
    setPortalBusy(true)
    try {
      await apiRequest(`/api/v1/users/${portalUserId}/reset-password`, {
        method: 'POST',
        token: accessToken,
        body: { temporary_password: temp, require_password_change: true },
      })
      setPortalOncePassword(temp)
      setPortalPassword('')
      toast.success('Portal password reset. Sessions revoked — copy the temporary password now.')
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.displayMessage() : 'Could not reset portal password',
      )
    } finally {
      setPortalBusy(false)
    }
  }

  const handleRotateApiKey = async () => {
    const keyId = gatewayConfig?.keys.find((k) => k.status === 'ACTIVE')?.id
    if (!accessToken || !params.id || !keyId || keyRotateBusy) return
    setKeyRotateBusy(true)
    try {
      const revealed = await apiRequest<GatewaySecretReveal>(
        `/api/v1/merchants/${params.id}/gateway/keys/${keyId}/rotate`,
        { method: 'POST', token: accessToken },
      )
      setKeyRotateConfirm(false)
      setSecretReveal(revealed)
      toast.success('Key rotated. The old key keeps working for 24 hours.')
      await load({ silent: true })
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.displayMessage() : 'Could not rotate API key')
    } finally {
      setKeyRotateBusy(false)
    }
  }

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
  const gatewayLocked = merchant?.integration_type === 'API'
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

  const activeKey = gatewayConfig?.keys.find((k) => k.status === 'ACTIVE') ?? null
  const activeKeyPrefix = activeKey?.key_prefix ?? null

  return (
    <AppShell title={`${merchantLabel()} Detail`} role={user.role} menus={menus}>
      <PageHeader
        title={merchant?.display_name ?? `${merchantLabel()} Detail`}
        {...(merchant ? { subtitle: `${merchant.merchant_code} · ${merchant.legal_name}` } : {})}
        backHref="/merchants"
        backLabel={merchantLabel({ plural: true })}
        action={
          merchant ? (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
              style={{
                borderColor: 'var(--qp-border)',
                color: 'var(--qp-text-secondary)',
                backgroundColor: '#fff',
              }}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Advanced Settings
            </button>
          ) : null
        }
      />
      <div className="mb-qp-gap">
        <ErrorAlert message={error} />
      </div>
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <FormShell compact width="full">
          <FormSection title={merchantLabel()}>
            <FormGrid cols={5}>
              <FormField label={`${merchantLabel()} Code`}>
                <Input value={merchant.merchant_code} readOnly />
              </FormField>
              <FormField label="Exchange Name">
                <Input value={merchant.legal_name} readOnly />
              </FormField>
              <FormField label="Deposit Charge (%)">
                <RateInput
                  id="edit-payin"
                  valueBp={payinBp}
                  onChangeBp={setPayinBp}
                  disabled={!canEdit || savingPrimary}
                />
              </FormField>
              <FormField label="Withdrawal Charge (%)">
                <RateInput
                  id="edit-payout"
                  valueBp={payoutBp}
                  onChangeBp={setPayoutBp}
                  disabled={!canEdit || savingPrimary}
                />
              </FormField>
              <FormField label="Display Name">
                <Input value={merchant.display_name} readOnly />
              </FormField>

              <FormField label="URL (Webhook)">
                <div className="flex items-center gap-1">
                  {gatewayConfig?.enabled && isSuperAdmin && canEdit ? (
                    <>
                      <Input
                        value={webhookUrlDraft}
                        onChange={(e) => setWebhookUrlDraft(e.target.value)}
                        placeholder="https://panel.example.com/webhook"
                        className="font-mono text-xs"
                        disabled={savingPrimary}
                        aria-label="Webhook URL"
                      />
                      {webhookUrlDraft.trim() ? (
                        <CopyButton value={webhookUrlDraft.trim()} label="Copy webhook URL" />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Input
                        value={
                          gatewayConfig?.webhook_url?.trim() ||
                          (gatewayConfig?.enabled ? '—' : 'Enable Gateway in Advanced Settings')
                        }
                        readOnly
                        className="font-mono text-xs"
                      />
                      {gatewayConfig?.webhook_url ? (
                        <CopyButton value={gatewayConfig.webhook_url} label="Copy webhook URL" />
                      ) : null}
                    </>
                  )}
                </div>
              </FormField>
              <FormField label="Payout URL (API path)">
                <Input
                  value={gatewayConfig?.base_url_path?.trim() || '—'}
                  readOnly
                  className="font-mono text-xs"
                />
              </FormField>
              <div className="col-span-1 md:col-span-2">
                <FormField label={`Assigned Bankers (Deposit Managed By)`}>
                  <Select
                    value={bankAdminMode}
                    onChange={(e) => setBankAdminMode(e.target.value as BankAdminMode)}
                    disabled={savingPrimary || !canEditBankAdmins}
                    className="flex-1"
                  >
                    <option value="ALL">All {bankerLabel({ plural: true })}</option>
                    <option value="SELECTED">Selected {bankerLabel({ plural: true })}</option>
                  </Select>
                  {bankAdminMode === 'SELECTED' && (
                    <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto border rounded p-2 bg-white">
                      {activeAdmins.map((admin) => (
                        <label key={admin.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={bankAdminIds.includes(admin.id)}
                            onChange={() => handleToggleBankAdmin(admin.id)}
                            disabled={savingPrimary || !canEditBankAdmins}
                          />
                          {admin.username}
                        </label>
                      ))}
                    </div>
                  )}
                </FormField>
              </div>
              <div className="col-span-1 md:col-span-3">
                <FormField label="API Key">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Input
                        value={
                          activeKeyPrefix
                            ? `${activeKeyPrefix}…`
                            : gatewayConfig?.enabled
                              ? 'No keys — create in Advanced Settings'
                              : 'Enable Gateway in Advanced Settings'
                        }
                        readOnly
                        className="font-mono"
                        aria-label="API key prefix"
                      />
                      {isSuperAdmin && canEdit && activeKey ? (
                        <PrimaryButton
                          disabled={keyRotateBusy || savingPrimary}
                          onClick={() => setKeyRotateConfirm(true)}
                        >
                          Rotate key
                        </PrimaryButton>
                      ) : null}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
                      Prefix only on this screen. Full key is shown once when you enable, create, or rotate
                      (use Rotate key).
                    </p>
                  </div>
                </FormField>
              </div>
              <div className="col-span-1 md:col-span-3">
                <FormField label="Webhook secret (verifies x-sp-signature)">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Input
                        value={
                          gatewayConfig?.enabled
                            ? 'whsec_••••••••'
                            : 'Enable Gateway in Advanced Settings'
                        }
                        readOnly
                        className="font-mono"
                        aria-label="Webhook secret"
                      />
                      {isSuperAdmin && canEdit && gatewayConfig?.enabled ? (
                        <PrimaryButton
                          disabled={secretRegenBusy || savingPrimary}
                          onClick={() => setSecretRegenConfirm(true)}
                        >
                          Regenerate
                        </PrimaryButton>
                      ) : null}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
                      Secret is shown once when you enable Gateway or regenerate. It cannot be read again.
                    </p>
                  </div>
                </FormField>
              </div>
            </FormGrid>
            {(canEdit || canEditBankAdmins) ? (
              <div className="mt-qp-gap flex justify-end">
                <PrimaryButton disabled={savingPrimary} onClick={() => void handlePrimaryUpdate()}>
                  {savingPrimary ? 'Saving…' : 'Update'}
                </PrimaryButton>
              </div>
            ) : null}
            <div
              className="mt-qp-gap flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
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
        </FormShell>
      )}

      {merchant ? (
          <Drawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            title="Advanced Settings"
            size="3xl"
          >
            <FormSection title="Contacts">
              <FormGrid>
                <FormField label="Contact Email">
                  <Input value={merchant.contact_email ?? '—'} readOnly />
                </FormField>
                <FormField label="Contact Mobile">
                  <Input value={merchant.contact_mobile ?? '—'} readOnly />
                </FormField>
              </FormGrid>
            </FormSection>

          {canEdit ? (
            <FormSection
              title="Portal access"
              description={`One ${merchantLabel()} login (username = ${merchantLabel()} code). View-only Dashboard, Pay-In, Pay-Out, and Transactions.`}
            >
              {merchant.portal_user_id && merchant.portal_user_status === 'ACTIVE' ? (
                <div className="space-y-3">
                  <FormGrid>
                    <FormField label="Portal username">
                      <Input value={merchant.portal_username ?? merchant.merchant_code} readOnly />
                    </FormField>
                    <FormField label="Portal status">
                      <div className="flex min-h-8 items-center px-qp-ctl-x">
                        <StatusBadge status={merchant.portal_user_status} />
                      </div>
                    </FormField>
                  </FormGrid>
                  {portalOncePassword ? (
                    <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--qp-border)' }}>
                      Temporary password (shown once): <strong className="font-mono">{portalOncePassword}</strong>
                      <span className="ml-2 inline-flex align-middle">
                        <CopyButton
                          value={portalOncePassword}
                          label="Copy temporary portal password"
                          successMessage="Copied temporary portal password"
                        />
                      </span>
                    </p>
                  ) : null}
                  <FormField
                    label="Temporary password"
                    required
                    hint="Sets a new temporary password and forces change on next portal login. Does not use the current password."
                  >
                    <Input
                      type="password"
                      value={portalPassword}
                      onChange={(event) => setPortalPassword(event.target.value)}
                      autoComplete="new-password"
                      aria-label="Temporary portal password for reset"
                    />
                  </FormField>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      onClick={() => void handlePortalResetPassword()}
                      disabled={portalBusy || !portalPassword.trim()}
                    >
                      Reset portal password
                    </PrimaryButton>
                    <PrimaryButton onClick={() => setPortalDisableConfirm(true)} disabled={portalBusy}>
                      Disable portal
                    </PrimaryButton>
                  </div>
                </div>
              ) : merchant.portal_user_id && merchant.portal_user_status === 'DISABLED' ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
                    Portal user <span className="font-mono">{merchant.portal_username}</span> is disabled.
                    Set a temporary password to re-enable ({merchantLabel()} must be ACTIVE).
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
            <FormSection
              title={agentLabel()}
              description="Upper-line brokerage carved from Super Admin margin (between us and the Exchange). Banker rates must stay ≤ Exchange − Agent."
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
            <>
              <PayoutBankersFormSection
                mode={payoutBankerMode}
                selectedIds={payoutBankerIds}
                admins={activeAdmins}
                defaultRoutingMode={routingMode}
                defaultAdminId={routingAdminId}
                onModeChange={setPayoutBankerMode}
                onToggleAdmin={handleTogglePayoutAdmin}
                onDefaultRoutingModeChange={setRoutingMode}
                onDefaultAdminChange={setRoutingAdminId}
                disabled={savingRouting}
              />
              <div className="-mt-1 flex justify-end">
                <PrimaryButton
                  type="button"
                  disabled={
                    savingRouting ||
                    (payoutBankerMode === 'SELECTED' && payoutBankerIds.length === 0) ||
                    (routingMode === 'direct' && !routingAdminId)
                  }
                  onClick={() => void handleSaveRouting()}
                >
                  {savingRouting ? 'Saving…' : 'Save routing'}
                </PrimaryButton>
              </div>
            </>
          ) : (
            <FormSection title="Withdrawal routing">
              <FormField label="New withdrawals go to">
                <Input
                  value={
                    merchant.default_payout_banker_username ??
                    merchant.default_payout_banker_user_id ??
                    'Super Admin queue'
                  }
                  readOnly
                />
              </FormField>
              <FormField label="Who may take withdrawals">
                <Input
                  value={
                    (merchant.payout_banker_mode ?? 'ALL') === 'ALL'
                      ? `All ${bankerLabel({ plural: true })}`
                      : `Selected ${bankerLabel({ plural: true })} (${(merchant.payout_banker_user_ids ?? []).length})`
                  }
                  readOnly
                />
              </FormField>
            </FormSection>
          )}

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
                  disabled={!canEdit || lockedPanel !== 'none' || gatewayLocked || panelBusy}
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
              <div className="mt-qp-gap">
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
              <div className="mt-qp-gap">
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
                {gatewayLocked
                  ? 'This exchange master uses the Gateway API. Panel integrations are not available.'
                  : 'No panel selected. Choose Supago or Crici to connect credentials.'}
              </p>
            ) : null}
          </FormSection>

          {isSuperAdmin ? (
            <GatewayIntegrationSection
              merchantId={merchant.id}
              panelLocked={connectedPanel !== 'none'}
              canEdit={canEdit}
              onChanged={() => void load({ silent: true })}
            />
          ) : null}

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
          </Drawer>
      ) : null}

      {confirmDisconnect ? (
        <ConfirmDialog
          title="Clear Supago credentials?"
          subtitle={`The cached token will be evicted and credentials removed. This ${merchantLabel()} stays locked to Supago — you can reconnect the same panel, but cannot switch to Crici.`}
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
          subtitle={`The cached session will be cleared and credentials removed. This ${merchantLabel()} stays locked to Crici — you can reconnect the same panel, but cannot switch to Supago.`}
          confirmLabel="Clear credentials"
          variant="danger"
          loading={criciLoading}
          onConfirm={() => void handleCriciDisconnect()}
          onCancel={() => setConfirmCriciDisconnect(false)}
        />
      ) : null}

      {statusConfirm === 'SUSPENDED' ? (
        <ConfirmDialog
          title={`Suspend ${merchant?.legal_name ?? merchantLabel()}?`}
          subtitle={`All banks synced with this ${merchantLabel()} will be disabled (panel + CRM). Panel credentials are cleared. Polls stop until you Activate and reconnect.`}
          confirmLabel="Suspend"
          loading={statusSubmitting}
          onConfirm={() => void handleMerchantStatus()}
          onCancel={() => setStatusConfirm(null)}
        />
      ) : null}

      {statusConfirm === 'ACTIVE' ? (
        <ConfirmDialog
          title={`Activate ${merchant?.legal_name ?? merchantLabel()}?`}
          subtitle={`Sets the ${merchantLabel()} ACTIVE only. Reconnect panel credentials here, then re-enable banks from Bank Details. Banks are not restored automatically.`}
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

      {secretRegenConfirm ? (
        <ConfirmDialog
          title="Regenerate webhook secret?"
          subtitle="Webhooks are signed with the new secret immediately. Update the panel before the next event."
          confirmLabel="Regenerate"
          loading={secretRegenBusy}
          onConfirm={() => void handleRegenerateWebhookSecret()}
          onCancel={() => setSecretRegenConfirm(false)}
        />
      ) : null}

      {keyRotateConfirm ? (
        <ConfirmDialog
          title="Rotate API key?"
          subtitle="A new full key is shown once. The previous key keeps working for 24 hours."
          confirmLabel="Rotate key"
          loading={keyRotateBusy}
          onConfirm={() => void handleRotateApiKey()}
          onCancel={() => setKeyRotateConfirm(false)}
        />
      ) : null}

      {secretReveal ? (
        <Modal
          title="Copy these now"
          size="lg"
          footer={
            <div className="flex justify-end">
              <PrimaryButton onClick={() => setSecretReveal(null)}>I have stored them</PrimaryButton>
            </div>
          }
        >
          <p className="mb-3 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
            These values are shown once and cannot be read again. Store them in the panel&apos;s secret store.
          </p>
          {secretReveal.api_key ? (
            <FormField label="API key (x-api-key)">
              <div className="flex items-center gap-1">
                <Input
                  value={secretReveal.api_key}
                  readOnly
                  className="font-mono"
                  aria-label="Full API key"
                />
                <CopyButton
                  value={secretReveal.api_key}
                  label="Copy full API key"
                  successMessage="Copied full API key"
                />
              </div>
            </FormField>
          ) : null}
          {secretReveal.webhook_secret ? (
            <FormField label="Webhook secret (verifies x-sp-signature)">
              <div className="flex items-center gap-1">
                <Input
                  value={secretReveal.webhook_secret}
                  readOnly
                  className="font-mono"
                  aria-label="Webhook secret"
                />
                <CopyButton
                  value={secretReveal.webhook_secret}
                  label="Copy full webhook secret"
                  successMessage="Copied full webhook secret"
                />
              </div>
            </FormField>
          ) : null}
        </Modal>
      ) : null}
    </AppShell>
  )
}
