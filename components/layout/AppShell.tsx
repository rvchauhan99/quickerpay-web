'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MenuCode, MenuGrant, UserRole } from '@quickerpay/shared-types'
import { PHASE_1_ADMIN_MENUS } from '@quickerpay/shared-types'
import { HeaderToggles } from './HeaderToggles'

const LABELS: Record<MenuCode, string> = {
  DASHBOARD: 'Dashboard',
  USERS: 'User Management',
  MERCHANTS: 'Merchants',
  BANKS: 'Bank Details',
  UPI: 'UPI',
  PAYIN: 'Pay-In',
  PAYOUT: 'Pay-Out',
  UTR: 'UTR Entries',
  TRANSACTIONS: 'Transactions',
  INTER_TRANSFER: 'Inter Transfer',
  LEDGER: 'Ledger',
  COMMISSION: 'Commission',
  REPORTS: 'Reports',
  AUDIT: 'Audit',
  SETTINGS: 'Settings',
  SUPPORT: 'Support',
}

const HREF: Partial<Record<MenuCode, string>> = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  MERCHANTS: '/merchants',
  BANKS: '/banks',
  UPI: '/upi',
  PAYIN: '/payin',
  PAYOUT: '/payout',
  UTR: '/utr',
  LEDGER: '/ledger',
  COMMISSION: '/commission',
  INTER_TRANSFER: '/inter-transfers',
  TRANSACTIONS: '/transactions',
  REPORTS: '/reports',
  AUDIT: '/audit',
  SETTINGS: '/settings',
}

export function AppShell({
  title,
  role,
  menus,
  children,
}: {
  title: string
  role: UserRole
  menus: MenuGrant[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <Navigation menus={menus} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 items-center justify-between border-b border-zinc-200 bg-white px-3">
          <h1 className="text-sm font-semibold">{title}</h1>
          <HeaderToggles />
        </header>
        <main className="min-w-0 flex-1 p-3">{children}</main>
      </div>
    </div>
  )
}

export function Navigation({ menus, role }: { menus: MenuGrant[]; role: UserRole }) {
  const pathname = usePathname()
  const order = [...PHASE_1_ADMIN_MENUS, 'UPI', 'TRANSACTIONS', 'COMMISSION', 'MERCHANTS', 'REPORTS', 'AUDIT', 'SETTINGS'] as MenuCode[]
  const items = [...menus]
    .filter((row) => row.can_view && HREF[row.menu_code])
    .sort((a, b) => order.indexOf(a.menu_code) - order.indexOf(b.menu_code))
    .map((row) => ({
      href: HREF[row.menu_code] as string,
      label: LABELS[row.menu_code],
      extra:
        row.menu_code === 'COMMISSION' && row.can_edit
          ? [{ href: '/commission/config', label: 'Commission config' }]
          : [],
    }))

  return (
    <nav className="w-48 shrink-0 border-r border-zinc-200 bg-white px-2 py-3" aria-label="Main">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">QuickerPay</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} active={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
              {item.label}
            </NavLink>
            {item.extra.map((extra) => (
              <NavLink key={extra.href} href={extra.href} active={pathname === extra.href} nested>
                {extra.label}
              </NavLink>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-4 px-2 text-[10px] uppercase text-zinc-400">{role.replace('_', ' ')}</p>
    </nav>
  )
}

function NavLink({
  href,
  active,
  nested,
  children,
}: {
  href: string
  active: boolean
  nested?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`block rounded px-2 py-1 text-sm ${nested ? 'pl-4 text-xs' : ''} ${
        active ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'
      }`}
    >
      {children}
    </Link>
  )
}
