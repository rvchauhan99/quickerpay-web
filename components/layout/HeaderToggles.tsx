'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiRequest } from '@/lib/api'
import { useSession } from '@/lib/session'

/* ─── Toggle chip: pill-style with coloured dot indicator ─────────────────── */
function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150"
      style={{
        borderColor: active ? 'var(--qp-primary)' : 'var(--qp-border)',
        backgroundColor: active ? 'var(--qp-primary-light)' : '#ffffff',
        color: active ? 'var(--qp-primary-dark)' : 'var(--qp-text-secondary)',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? 'var(--qp-primary)' : '#cbd5e1' }}
      />
      {label}: <span className="font-semibold">{active ? 'ON' : 'OFF'}</span>
    </button>
  )
}

/* ─── User avatar with initials ───────────────────────────────────────────── */
function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: 'var(--qp-sidebar-active)' }}
    >
      {initials}
    </div>
  )
}

/* ─── HeaderToggles ───────────────────────────────────────────────────────── */
export function HeaderToggles() {
  const { user, accessToken, logout, refreshUser } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [offlineConfirmOpen, setOfflineConfirmOpen] = useState(false)
  const [onlineSubmitting, setOnlineSubmitting] = useState(false)
  const [autoAcceptConfirm, setAutoAcceptConfirm] = useState<'on' | 'off' | null>(null)
  const [autoAcceptSubmitting, setAutoAcceptSubmitting] = useState(false)

  if (!user) return null

  const showAutoAccept = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const showOnline = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'OPERATOR'

  const handleAutoAccept = () => {
    if (!accessToken) return
    setAutoAcceptConfirm(user.auto_accept_enabled ? 'off' : 'on')
  }

  const patchAutoAccept = async (enabled: boolean) => {
    if (!accessToken) return
    setAutoAcceptSubmitting(true)
    setError(null)
    try {
      await apiRequest('/api/v1/users/me/auto-accept', {
        method: 'PATCH',
        token: accessToken,
        body: { auto_accept_enabled: enabled },
      })
      await refreshUser()
      setAutoAcceptConfirm(null)
    } catch {
      setError('Auto Accept could not be updated')
    } finally {
      setAutoAcceptSubmitting(false)
    }
  }

  const handleOnline = async () => {
    if (!accessToken) return
    if (user.operational_state === 'ONLINE') {
      setOfflineConfirmOpen(true)
      return
    }
    await patchOperationalState('ONLINE')
  }

  const patchOperationalState = async (next: 'ONLINE' | 'OFFLINE') => {
    if (!accessToken) return
    setOnlineSubmitting(true)
    setError(null)
    try {
      await apiRequest('/api/v1/users/me/operational-state', {
        method: 'PATCH',
        token: accessToken,
        body: { operational_state: next },
      })
      await refreshUser()
      setOfflineConfirmOpen(false)
    } catch {
      setError('Online status could not be updated')
    } finally {
      setOnlineSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span
          className="rounded-md px-2 py-1 text-[11px] font-medium"
          style={{ backgroundColor: 'var(--qp-danger-bg)', color: 'var(--qp-danger)' }}
        >
          {error}
        </span>
      ) : null}

      {offlineConfirmOpen ? (
        <ConfirmDialog
          title="Go offline?"
          subtitle="All ACTIVE banks you own will be disabled, including their UPIs. Linked Supago banks will sync to inactive. Other Admins' banks are not affected. Going Online again will not re-enable them — turn banks back on from Bank Details."
          confirmLabel="Go offline"
          loading={onlineSubmitting}
          onCancel={() => setOfflineConfirmOpen(false)}
          onConfirm={() => void patchOperationalState('OFFLINE')}
        />
      ) : null}

      {autoAcceptConfirm === 'on' ? (
        <ConfirmDialog
          title="Turn on Auto Accept?"
          subtitle="Matching pay-ins may auto-accept when every condition is met: this master switch ON, per-UPI auto-accept ON, UPI and bank ACTIVE, an assigned Operator ONLINE, within limits, no duplicate UTR, and tenant active. If any condition fails, the pay-in stays UNDER_REVIEW for manual action."
          confirmLabel="Turn on"
          variant="primary"
          loading={autoAcceptSubmitting}
          onCancel={() => setAutoAcceptConfirm(null)}
          onConfirm={() => void patchAutoAccept(true)}
        />
      ) : null}

      {autoAcceptConfirm === 'off' ? (
        <ConfirmDialog
          title="Turn off Auto Accept?"
          subtitle="This master switch turns off auto-accept on all your UPIs, even if a UPI still has auto-accept enabled. New matching pay-ins go to UNDER_REVIEW until you accept manually. Bank and UPI status are not changed."
          confirmLabel="Turn off"
          loading={autoAcceptSubmitting}
          onCancel={() => setAutoAcceptConfirm(null)}
          onConfirm={() => void patchAutoAccept(false)}
        />
      ) : null}

      {/* Status toggles */}
      {showAutoAccept ? (
        <ToggleChip
          label="Auto Accept"
          active={user.auto_accept_enabled}
          onClick={() => handleAutoAccept()}
        />
      ) : null}
      {showOnline ? (
        <ToggleChip
          label="Online"
          active={user.operational_state === 'ONLINE'}
          onClick={() => void handleOnline()}
        />
      ) : null}

      {/* Divider */}
      <div className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--qp-border)' }} />

      {/* User info */}
      <a href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50">
        <UserAvatar name={user.display_name} />
        <div className="hidden flex-col sm:flex">
          <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--qp-text-primary)' }}>
            {user.display_name}
          </span>
          <span className="text-[10px] uppercase leading-tight" style={{ color: 'var(--qp-text-muted)' }}>
            {user.role.replaceAll('_', ' ')}
          </span>
        </div>
      </a>

      {/* Logout */}
      <button
        type="button"
        onClick={() => void logout()}
        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        style={{ color: 'var(--qp-text-muted)' }}
        aria-label="Logout"
        title="Logout"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--qp-danger-bg)'
          e.currentTarget.style.color = 'var(--qp-danger)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--qp-text-muted)'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>
  )
}

