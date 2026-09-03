'use client'

import { FormSection } from '@/components/forms/FormSection'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import type { BankAdminMode } from '@quickerpay/shared-types'

export const BANK_ADMINS_HELPER =
  "Who may manage deposits (sync/enable banks) on this merchant's Supago. All Admins — every Admin can provision and enable banks for this merchant. Selected Admins — only the Admins you pick can. Others cannot link or enable banks here. Changing from All to Selected (or removing an Admin) disables that Admin's banks on this merchant only."

export const BANK_ADMINS_HELPER_SHORT =
  'Who may manage deposits (sync/enable banks) on this merchant. Narrowing selection disables that Admin’s banks here only.'

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
          <option value="ALL">All Admins</option>
          <option value="SELECTED">Selected Admins</option>
        </Select>
      </FormField>
      {mode === 'SELECTED' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--qp-text-secondary)' }}>Select at least one Admin, or choose All Admins.</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--qp-border)', backgroundColor: '#fff' }}>
            {admins.length === 0 ? (
              <li className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>No ACTIVE Admins available</li>
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
                        aria-label={`Select Admin ${admin.username}`}
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
