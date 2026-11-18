import type { MenuActions, MenuCode, MenuGrant, UserRole } from '@quickerpay/shared-types'
import { clampMenuGrant, menusForRole, preferredGrantForMenu } from '@quickerpay/shared-types'

/** Actor / supervisor grants keyed by menu code (view-bearing rows only). */
export function menuGrantMap(grants: MenuGrant[]): Map<MenuCode, MenuActions> {
  const map = new Map<MenuCode, MenuActions>()
  for (const grant of grants) {
    if (
      !grant.can_view &&
      !grant.can_create &&
      !grant.can_edit &&
      !grant.can_approve &&
      !grant.can_export
    ) {
      continue
    }
    map.set(grant.menu_code, {
      can_view: grant.can_view,
      can_create: grant.can_create,
      can_edit: grant.can_edit,
      can_approve: grant.can_approve,
      can_export: grant.can_export,
    })
  }
  return map
}

/**
 * Menus the UI may offer: target role ceiling ∩ actor grants ∩ optional supervisor ceiling.
 * Order follows the role ceiling.
 */
export function offerableMenus(params: {
  actorMenus: MenuGrant[]
  targetRole: UserRole
  supervisorMenus?: MenuGrant[] | null | undefined
}): MenuCode[] {
  const actor = menuGrantMap(params.actorMenus)
  const supervisor = params.supervisorMenus ? menuGrantMap(params.supervisorMenus) : null
  return menusForRole(params.targetRole).filter((code) => {
    if (!actor.get(code)?.can_view) return false
    if (supervisor && !supervisor.get(code)?.can_view) return false
    return true
  })
}

/** Max flags for one menu after role + actor (+ supervisor) clamp. */
export function offerableGrantForMenu(params: {
  targetRole: UserRole
  menu: MenuCode
  actorMenus: MenuGrant[]
  supervisorMenus?: MenuGrant[] | null | undefined
}): MenuActions {
  const actor = params.actorMenus.find((g) => g.menu_code === params.menu) ?? null
  const supervisor = params.supervisorMenus?.find((g) => g.menu_code === params.menu) ?? null
  const desired = preferredGrantForMenu(params.targetRole, params.menu)
  const afterActor = clampMenuGrant(params.targetRole, params.menu, desired, actor)
  if (!supervisor) return afterActor
  return clampMenuGrant(params.targetRole, params.menu, afterActor, supervisor)
}

export function grantsToPayload(
  selected: Array<MenuGrant | (MenuActions & { menu_code: MenuCode })>,
): Array<MenuActions & { menu_code: MenuCode }> {
  return selected.map((grant) => ({
    menu_code: grant.menu_code,
    can_view: grant.can_view,
    can_create: grant.can_create,
    can_edit: grant.can_edit,
    can_approve: grant.can_approve,
    can_export: grant.can_export,
  }))
}

/** Money-path menus where write/approve on an Operator is a bottom-line risk. */
export const OPERATOR_MONEY_MENUS: readonly MenuCode[] = ['PAYIN', 'PAYOUT', 'UTR'] as const

export function operatorMoneyWriteRisk(grants: Array<MenuActions & { menu_code: MenuCode }>): boolean {
  return grants.some(
    (grant) =>
      OPERATOR_MONEY_MENUS.includes(grant.menu_code) && (grant.can_edit || grant.can_approve),
  )
}
