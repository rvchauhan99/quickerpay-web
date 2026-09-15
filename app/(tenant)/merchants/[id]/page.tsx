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
import { apiRequest, ApiClientError } from '@/lib/api'
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
    if (detail.default_payout_admin_user_id) {
      setRoutingMode('direct')
      setRoutingAdminId(detail.default_payout_admin_user_id)
      return
    }
    setRoutingMode('queue')
    setRoutingAdminId('')
  }

  const applyBankAdminsFromDetail = (detail: MerchantDetail) => {
    setBankAdminMode(detail.bank_admin_mode ?? 'ALL')
    setBankAdminIds(detail.bank_admin_user_ids ?? [])
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
      void loadSupagoStatus(accessToken, params.id)
      void loadCriciStatus(accessToken, params.id)
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
      toast.success('Supago disconnected')
      setPanelChoice('none')
    } catch (caught) {
      setSupagoError(caught instanceof ApiClientError ? caught.message : 'Disconnect failed')
    } finally {
      setSupagoLoading(false)
    }
  }

  const handleCriciConnect = async () => {
    const trimmedUsername = criciUsername.trim()
    const trimmedPassword = criciPassword.trim()
    if (!accessToken || !params.id || !trimmedUsername || !trimmedPassword) return
    setCriciLoading(true)
    setCriciError(null)
    try {
      const status = await apiRequest<CriciStatus>(`/api/v1/merchants/${params.id}/crici`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          crici_username: trimmedUsername,
          crici_password: trimmedPassword,
        },
      })
      setCriciStatus(status)
      setCriciUsername('')
      setCriciPassword('')
      setCriciUpdateOpen(false)
      toast.success(criciUpdateOpen ? 'Crici credentials updated' : 'Crici connected')
      await loadCriciStatus(accessToken, params.id)
    } catch (caught) {
      setCriciError(caught instanceof ApiClientError ? caught.message : 'Connection failed')
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
      toast.success('Crici disconnected')
      setPanelChoice('none')
    } catch (caught) {
      setCriciError(caught instanceof ApiClientError ? caught.message : 'Disconnect failed')
    } finally {
      setCriciLoading(false)
    }
  }

  const handleSaveRouting = async () => {
    if (!accessToken || !params.id || savingRouting) return
    if (routingMode === 'direct' && !routingAdminId) {
      toast.error('Select an Admin for direct assign')
      return
    }
    setSavingRouting(true)
    try {
      const detail = await apiRequest<MerchantDetail>(`/api/v1/merchants/${params.id}/payout-routing`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          default_payout_admin_user_id: routingMode === 'direct' ? routingAdminId : null,
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
      toast.error('Select at least one Admin, or choose All Admins.')
      return
    }
    setSavingBankAdmins(true)
    try {
      await apiRequest(`/api/v1/merchants/${params.id}/bank-admins`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          bank_admin_mode: bankAdminMode,
          admin_user_ids: bankAdminMode === 'SELECTED' ? bankAdminIds : [],
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

  const canEdit = hasMenu(menus, 'MERCHANTS', 'can_edit')
  const canEditRouting = Boolean(isSuperAdmin && canEdit)
  const canEditBankAdmins = Boolean(isSuperAdmin && canEdit)
  const activeAdmins = admins.filter((row) => row.role === 'ADMIN' && row.status === 'ACTIVE')
  const connectedPanel: PanelIntegrationType = supagoStatus?.connected
    ? 'supago'
    : criciStatus?.connected
      ? 'crici'
      : 'none'
  const panelSelectValue = connectedPanel !== 'none' ? connectedPanel : panelChoice
  const panelBusy = supagoLoading || criciLoading
  const panelError =
    panelSelectValue === 'supago' ? supagoError : panelSelectValue === 'crici' ? criciError : null

  const handlePanelChoiceChange = (next: PanelIntegrationType) => {
    if (connectedPanel !== 'none') return
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
    }
  }

  return (
    <AppShell title="Merchant Detail" role={user.role} menus={menus}>
      <PageHeader
        title={merchant?.display_name ?? 'Merchant Detail'}
        {...(merchant ? { subtitle: `${merchant.merchant_code} · ${merchant.legal_name}` } : {})}
        backHref="/merchants"
        backLabel="Merchants"
      />
      <div className="mb-4">
        <ErrorAlert message={error} />
      </div>
      {loading || !merchant ? (
        <TableSkeleton />
      ) : (
        <FormShell wide compact>
          <FormSection title="Merchant">
            <FormGrid>
              <FormField label="Legal Name">
                <Input value={merchant.legal_name} readOnly />
              </FormField>
              <FormField label="Merchant Code">
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
              aria-label="Merchant status"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
                Status
              </span>
              <StatusBadge status={merchant.status} />
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
                    <option value="direct">Direct to Admin</option>
                  </Select>
                </FormField>
                {routingMode === 'direct' ? (
                  <FormField label="Admin" required>
                    <Select
                      id="withdraw-routing-admin"
                      value={routingAdminId}
                      onChange={(event) => setRoutingAdminId(event.target.value)}
                      aria-label="Default payout Admin"
                    >
                      <option value="">Select Admin</option>
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
          ) : merchant.default_payout_admin_user_id ? (
            <FormSection title="Withdraw routing">
              <FormField label="Direct Admin">
                <Input
                  value={merchant.default_payout_admin_username ?? merchant.default_payout_admin_user_id}
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
            description="One external panel per merchant. Choose Supago or Crici, then connect."
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
                  disabled={!canEdit || connectedPanel !== 'none' || panelBusy}
                  onChange={(event) => handlePanelChoiceChange(event.target.value as PanelIntegrationType)}
                  aria-label="Panel integration type"
                >
                  <option value="none">None</option>
                  <option value="supago">Supago</option>
                  <option value="crici">Crici</option>
                </Select>
              </FormField>
            </FormGrid>
            {connectedPanel !== 'none' ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                Disconnect to change integration.
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
                          Disconnect
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
                        {supagoLoading ? 'Connecting…' : 'Connect'}
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
                          Disconnect
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
                        </FormGrid>
                        <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                          Password is write-only. It is never shown after connect.
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
                    </FormGrid>
                    <p className="mt-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                      Password is write-only after connect.
                    </p>
                    <div className="mt-3 flex justify-end">
                      <PrimaryButton
                        onClick={() => void handleCriciConnect()}
                        disabled={panelBusy || !criciUsername.trim() || !criciPassword.trim()}
                      >
                        {criciLoading ? 'Connecting…' : 'Connect'}
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
          title="Disconnect Supago?"
          subtitle="The cached token will be evicted and credentials removed. You can reconnect at any time."
          confirmLabel="Disconnect"
          variant="danger"
          loading={supagoLoading}
          onConfirm={() => void handleSupagoDisconnect()}
          onCancel={() => setConfirmDisconnect(false)}
        />
      ) : null}

      {confirmCriciDisconnect ? (
        <ConfirmDialog
          title="Disconnect Crici?"
          subtitle="The cached session will be cleared and credentials removed. You can reconnect at any time."
          confirmLabel="Disconnect"
          variant="danger"
          loading={criciLoading}
          onConfirm={() => void handleCriciDisconnect()}
          onCancel={() => setConfirmCriciDisconnect(false)}
        />
      ) : null}
    </AppShell>
  )
}
