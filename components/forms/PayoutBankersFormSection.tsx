'use client'

import { FormSection } from '@/components/forms/FormSection'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import type { PayoutBankerMode } from '@quickerpay/shared-types'
import { bankerLabel, merchantLabel } from '@/lib/labels'

export const PAYOUT_BANKERS_HELPER =
  `Who may take withdrawals for this ${merchantLabel().toLowerCase()}. All ${bankerLabel({ plural: true })} — any ACTIVE ${bankerLabel()} may accept or be auto-assigned. Selected ${bankerLabel({ plural: true })} — only the ${bankerLabel({ plural: true }).toLowerCase()} you pick. Optional default ${bankerLabel()} auto-assigns new panel/Gateway withdrawals when set (must be in the allowlist when Selected).`

export interface PayoutBankerOption {
  id: string
  username: string
  display_name?: string
}

type DefaultRoutingMode = 'queue' | 'direct'

interface PayoutBankersFormSectionProps {
  mode: PayoutBankerMode
  selectedIds: string[]
  admins: PayoutBankerOption[]
  defaultRoutingMode: DefaultRoutingMode
  defaultAdminId: string
  onModeChange: (mode: PayoutBankerMode) => void
  onToggleAdmin: (adminId: string) => void
  onDefaultRoutingModeChange: (mode: DefaultRoutingMode) => void
  onDefaultAdminChange: (adminId: string) => void
  disabled?: boolean
}

export function PayoutBankersFormSection({
  mode,
  selectedIds,
  admins,
  defaultRoutingMode,
  defaultAdminId,
  onModeChange,
  onToggleAdmin,
  onDefaultRoutingModeChange,
  onDefaultAdminChange,
  disabled = false,
}: PayoutBankersFormSectionProps) {
  const defaultCandidates =
    mode === 'SELECTED' ? admins.filter((row) => selectedIds.includes(row.id)) : admins

  return (
    <FormSection title="Withdrawal routing" description={PAYOUT_BANKERS_HELPER}>
      <FormField label="Who may take withdrawals">
        <Select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as PayoutBankerMode)}
          disabled={disabled}
          aria-label="Withdrawal banker mode"
        >
          <option value="ALL">All {bankerLabel({ plural: true })}</option>
          <option value="SELECTED">Selected {bankerLabel({ plural: true })}</option>
        </Select>
      </FormField>
      {mode === 'SELECTED' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
            Select at least one {bankerLabel()}, or choose All {bankerLabel({ plural: true })}.
          </p>
          <ul
            className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2"
            style={{ borderColor: 'var(--qp-border)', backgroundColor: '#fff' }}
          >
            {admins.length === 0 ? (
              <li className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                No ACTIVE {bankerLabel({ plural: true })} available
              </li>
            ) : (
              admins.map((admin) => {
                const checked = selectedIds.includes(admin.id)
                return (
                  <li key={admin.id}>
                    <label
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      style={{ color: 'var(--qp-text-primary)' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggleAdmin(admin.id)}
                        aria-label={`Select payout ${bankerLabel()} ${admin.username}`}
                      />
                      <span>
                        {admin.username}
                        {admin.display_name ? ` — ${admin.display_name}` : ''}
                      </span>
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <FormField label="Default assign" required>
          <Select
            id="withdraw-routing-mode"
            value={defaultRoutingMode}
            onChange={(event) => {
              const next = event.target.value as DefaultRoutingMode
              onDefaultRoutingModeChange(next)
              if (next === 'queue') onDefaultAdminChange('')
            }}
            disabled={disabled}
            aria-label="Withdraw default assign mode"
          >
            <option value="queue">Super Admin queue (assign later)</option>
            <option value="direct">Direct to {bankerLabel()}</option>
          </Select>
        </FormField>
        {defaultRoutingMode === 'direct' ? (
          <FormField label={`Default ${bankerLabel()}`} required>
            <Select
              id="withdraw-routing-admin"
              value={defaultAdminId}
              onChange={(event) => onDefaultAdminChange(event.target.value)}
              disabled={disabled}
              aria-label={`Default payout ${bankerLabel()}`}
            >
              <option value="">Select {bankerLabel()}</option>
              {defaultCandidates.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.username}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <FormField label="Current">
            <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
              Unassigned until Super Admin bulk-assigns
            </p>
          </FormField>
        )}
      </div>
    </FormSection>
  )
}
