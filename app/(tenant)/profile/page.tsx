'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PrimaryButton, ErrorAlert } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { apiRequest, ApiClientError } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const { ready, user, menus, accessToken, refreshUser } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [totpBusy, setTotpBusy] = useState(false)
  const [totpError, setTotpError] = useState<string | null>(null)
  const [totpOk, setTotpOk] = useState<string | null>(null)
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>

  const handleSubmit = async () => {
    if (!accessToken || changingPassword) return
    setError(null)
    setChangingPassword(true)
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        token: accessToken,
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setDone(true)
      toast.success('Password changed. Sign in again.')
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not change password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleGenerate = async () => {
    if (!accessToken) return
    setTotpBusy(true)
    setTotpError(null)
    setTotpOk(null)
    try {
      const result = await apiRequest<{ otpauth_url: string; secret: string; qr_png_data_url: string }>(
        '/api/v1/auth/2fa/generate',
        { method: 'POST', token: accessToken, body: {} },
      )
      setQr(result.qr_png_data_url)
      setSecret(result.secret)
    } catch (caught) {
      setTotpError(caught instanceof ApiClientError ? caught.message : 'Could not generate QR code')
    } finally {
      setTotpBusy(false)
    }
  }

  const handleEnable = async () => {
    if (!accessToken) return
    setTotpBusy(true)
    setTotpError(null)
    try {
      await apiRequest('/api/v1/auth/2fa/enable', {
        method: 'POST',
        token: accessToken,
        body: { totp: code },
      })
      setTotpOk('2FA enabled')
      setQr('')
      setSecret('')
      setCode('')
      await refreshUser()
    } catch (caught) {
      setTotpError(caught instanceof ApiClientError ? caught.message : 'Invalid code')
    } finally {
      setTotpBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!accessToken) return
    setConfirmDisable(false)
    setTotpBusy(true)
    setTotpError(null)
    try {
      await apiRequest('/api/v1/auth/2fa/disable', { method: 'POST', token: accessToken, body: {} })
      setTotpOk('2FA disabled')
      await refreshUser()
    } catch (caught) {
      setTotpError(caught instanceof ApiClientError ? caught.message : 'Could not disable 2FA')
    } finally {
      setTotpBusy(false)
    }
  }

  return (
    <AppShell title="Profile" role={user.role} menus={menus}>
      <PageHeader title="Profile & Security" />
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--qp-text-primary)]">
          {user.username} <span className="text-[var(--qp-text-muted)] font-normal ml-2">({user.role.replaceAll('_', ' ')})</span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <FormShell submitLabel={done ? undefined : changingPassword ? 'Saving…' : 'Change password'} onSubmit={done ? undefined : () => void handleSubmit()}>
          <FormSection title="Password Change" description="Update your login password.">
            {done ? (
              <ErrorAlert message="Password changed. Sign in again." type="success" />
            ) : (
              <FormGrid>
                <div className="md:col-span-2">
                  <ErrorAlert message={error} />
                </div>
                <FormField label="Current password" required>
                  <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                </FormField>
                <FormField label="New password" required>
                  <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </FormField>
              </FormGrid>
            )}
          </FormSection>
        </FormShell>

        <FormShell>
          <FormSection title="Authenticator (2FA)" description="Manage two-factor authentication for your account.">
            <div className="p-4">
              {totpError ? <ErrorAlert message={totpError} /> : null}
              {totpOk ? <ErrorAlert message={totpOk} type="success" /> : null}
              
              {user.two_fa_enabled ? (
                <div className="mt-4">
                  <p className="text-sm text-[var(--qp-text-primary)] mb-4">Two-factor authentication is currently <strong>enabled</strong>.</p>
                  <PrimaryButton
                    disabled={totpBusy}
                    onClick={() => setConfirmDisable(true)}
                  >
                    Disable 2FA
                  </PrimaryButton>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-[var(--qp-text-primary)] mb-4">Two-factor authentication is <strong>not enabled</strong>.</p>
                  {!qr ? (
                    <PrimaryButton
                      disabled={totpBusy}
                      onClick={() => void handleGenerate()}
                    >
                      Set up 2FA
                    </PrimaryButton>
                  ) : (
                    <div className="mt-4 border rounded p-4 bg-[var(--qp-bg-card)]">
                      <p className="mb-2 text-sm font-medium">1. Scan this code</p>
                      <img src={qr} alt="2FA QR Code" className="mb-2 h-32 w-32 border border-zinc-200" />
                      <p className="mb-4 text-xs font-mono text-[var(--qp-text-muted)] select-all">{secret}</p>
                      
                      <p className="mb-2 text-sm font-medium">2. Enter verification code</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          className="w-32"
                          placeholder="000000"
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                        />
                        <PrimaryButton
                          disabled={totpBusy || code.length < 6}
                          onClick={() => void handleEnable()}
                        >
                          Verify & Enable
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormSection>
        </FormShell>
      </div>
      {confirmDisable ? (
        <ConfirmDialog
          title="Disable two-factor authentication?"
          confirmLabel="Disable 2FA"
          onCancel={() => setConfirmDisable(false)}
          onConfirm={() => void handleDisable()}
        />
      ) : null}
    </AppShell>
  )
}
