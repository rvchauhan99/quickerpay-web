'use client'

import { FormSection } from '@/components/forms/FormSection'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import type { BankAdminMode } from '@quickerpay/shared-types'
import { bankerLabel, merchantLabel } from '@/lib/labels'

export const BANK_ADMINS_HELPER =
  `Who may manage deposits (sync/enable banks) on this ${merchantLabel().toLowerCase()}'s Supago. All ${bankerLabel({ plural: true })} — every ${bankerLabel()} can provision and enable banks for this ${merchantLabel().toLowerCase()}. Selected ${bankerLabel({ plural: true })} — only the ${bankerLabel({ plural: true }).toLowerCase()} you pick can. Others cannot link or enable banks here. Changing from All to Selected (or removing a ${bankerLabel()}) disables that ${bankerLabel()}'s banks on this ${merchantLabel().toLowerCase()} only.`

export const BANK_ADMINS_HELPER_SHORT =
  `Who may manage deposits (sync/enable banks) on this ${merchantLabel().toLowerCase()}. Narrowing selection disables that ${bankerLabel()}'s banks here only.`

export interface BankAdminOption {
  id: string
  username: string
  display_name?: string
}

interface BankAdminsFormSectionProps {
  mode: BankAdminMode
  selectedIds: string[]
  admins: BankAdminOption[]
  onModeChange: (mode: BankAdminMode) => void
  onToggleAdmin: (adminId: string) => void
  disabled?: boolean
  /** Shorter section description for dense merchant forms. */
  compact?: boolean
}

export function BankAdminsFormSection({
  mode,
  selectedIds,
  admins,
  onModeChange,
  onToggleAdmin,
  disabled = false,
  compact = false,
}: BankAdminsFormSectionProps) {
  return (
    <FormSection title="Deposit Managed By" description={compact ? BANK_ADMINS_HELPER_SHORT : BANK_ADMINS_HELPER}>
      <FormField label="Managed by">
        <Select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as BankAdminMode)}
          disabled={disabled}
          aria-label="Deposit Managed By mode"
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
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--qp-border)', backgroundColor: '#fff' }}>
            {admins.length === 0 ? (
              <li className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                No ACTIVE {bankerLabel({ plural: true })} available
              </li>
            ) : (
              admins.map((admin) => {
                const checked = selectedIds.includes(admin.id)
                return (
                  <li key={admin.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--qp-text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggleAdmin(admin.id)}
                        aria-label={`Select ${bankerLabel()} ${admin.username}`}
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
    </FormSection>
  )
}
