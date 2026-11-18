'use client'

import type { MenuAction, MenuActions, MenuCode, MenuGrant, UserRole } from '@quickerpay/shared-types'
import { MENU_ACTIONS } from '@quickerpay/shared-types'
import { bankerLabel } from '@/lib/labels'
import { offerableGrantForMenu, offerableMenus } from '@/lib/menus'

const ACTION_LABEL: Record<MenuAction, string> = {
  can_view: 'View',
  can_create: 'Create',
  can_edit: 'Edit',
  can_approve: 'Approve',
  can_export: 'Export',
}

/**
 * Full menu × action checkbox grid. Disabled cells are actions outside
 * role ∩ actor ∩ optional supervisor ceilings (docs/03 §4.5).
 */
export function MenuAccessPicker(props: {
  targetRole: UserRole
  actorMenus: MenuGrant[]
  supervisorMenus?: MenuGrant[] | null
  value: Array<MenuActions & { menu_code: MenuCode }>
  onChange: (next: Array<MenuActions & { menu_code: MenuCode }>) => void
}) {
  const codes = offerableMenus({
    actorMenus: props.actorMenus,
    targetRole: props.targetRole,
    ...(props.supervisorMenus !== undefined ? { supervisorMenus: props.supervisorMenus } : {}),
  })

  const byCode = new Map(props.value.map((grant) => [grant.menu_code, grant]))

  const setFlag = (menu: MenuCode, action: MenuAction, on: boolean) => {
    const ceiling = offerableGrantForMenu({
      targetRole: props.targetRole,
      menu,
      actorMenus: props.actorMenus,
      ...(props.supervisorMenus !== undefined ? { supervisorMenus: props.supervisorMenus } : {}),
    })
    if (!ceiling[action]) return

    const current = byCode.get(menu) ?? {
      menu_code: menu,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_approve: false,
      can_export: false,
    }
    const nextGrant: MenuActions & { menu_code: MenuCode } = {
      ...current,
      [action]: on,
    }
    if (action !== 'can_view' && on) nextGrant.can_view = true
    if (action === 'can_view' && !on) {
      nextGrant.can_create = false
      nextGrant.can_edit = false
      nextGrant.can_approve = false
      nextGrant.can_export = false
    }

    const without = props.value.filter((g) => g.menu_code !== menu)
    const hasAny =
      nextGrant.can_view ||
      nextGrant.can_create ||
      nextGrant.can_edit ||
      nextGrant.can_approve ||
      nextGrant.can_export
    props.onChange(hasAny ? [...without, nextGrant] : without)
  }

  if (codes.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--qp-text-muted)' }}>
        No menus available to grant from your access
        {props.supervisorMenus ? ` and the supervising ${bankerLabel()} ceiling` : ''}.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--qp-border)' }}>
      <table className="min-w-full text-left text-xs" aria-label="Menu access">
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', color: 'var(--qp-text-muted)' }}>
            <th className="px-3 py-2 font-semibold uppercase tracking-wider">Module</th>
            {MENU_ACTIONS.map((action) => (
              <th key={action} className="px-2 py-2 font-semibold uppercase tracking-wider">
                {ACTION_LABEL[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const ceiling = offerableGrantForMenu({
              targetRole: props.targetRole,
              menu: code,
              actorMenus: props.actorMenus,
              ...(props.supervisorMenus !== undefined
                ? { supervisorMenus: props.supervisorMenus }
                : {}),
            })
            const held = byCode.get(code)
            return (
              <tr key={code} style={{ borderTop: '1px solid var(--qp-border)' }}>
                <td className="px-3 py-2 text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
                  {code.replaceAll('_', ' ')}
                </td>
                {MENU_ACTIONS.map((action) => {
                  const allowed = ceiling[action]
                  const checked = Boolean(held?.[action])
                  const title = allowed
                    ? undefined
                    : `Not available for this role or outside your (or the supervising ${bankerLabel()}) grants`
                  return (
                    <td key={action} className="px-2 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        style={{ borderColor: 'var(--qp-border)', accentColor: 'var(--qp-primary)' }}
                        checked={checked}
                        disabled={!allowed}
                        {...(title ? { title } : {})}
                        aria-label={`${code} ${ACTION_LABEL[action]}`}
                        onChange={(event) => setFlag(code, action, event.target.checked)}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
