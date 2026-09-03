'use client'

import { FormSection } from '@/components/forms/FormSection'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Select'
import type { BankAdminMode } from '@quickerpay/shared-types'

export const BANK_ADMINS_HELPER =
  "Who may sync and enable banks on this merchant's Supago. All Admins — every Admin can provision and enable banks for this merchant. Selected Admins — only the Admins you pick can. Others cannot link or enable banks here. Changing from All to Selected (or removing an Admin) disables that Admin's banks on this merchant only."

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
}

export function BankAdminsFormSection({
  mode,
  selectedIds,
  admins,
  onModeChange,
  onToggleAdmin,
  disabled = false,
}: BankAdminsFormSectionProps) {
  return (
    <FormSection title="Bank Admins" description={BANK_ADMINS_HELPER}>
      <FormField label="Who can sync banks">
        <Select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as BankAdminMode)}
          disabled={disabled}
          aria-label="Bank Admins mode"
        >
          <option value="ALL">All Admins</option>
          <option value="SELECTED">Selected Admins</option>
        </Select>
      </FormField>
      {mode === 'SELECTED' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-600">Select at least one Admin, or choose All Admins.</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-zinc-200 bg-white p-2">
            {admins.length === 0 ? (
              <li className="text-xs text-zinc-500">No ACTIVE Admins available</li>
            ) : (
              admins.map((admin) => {
                const checked = selectedIds.includes(admin.id)
                return (
                  <li key={admin.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
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
