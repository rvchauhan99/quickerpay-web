'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { MenuCode, MenuGrant, UserRole } from '@quickerpay/shared-types'
import { HeaderToggles } from './HeaderToggles'
import { isLabConsole } from '@/lib/lab'
import { useSession } from '@/lib/session'
import { FlaskConical } from 'lucide-react'

/* ─── Nav metadata ─────────────────────────────────────────────────────────── */
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
  SUPAGO_BANKS: 'Supago Banks',
}

const HREF: Partial<Record<MenuCode, string>> = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  MERCHANTS: '/merchants',
  SUPAGO_BANKS: '/supago-banks',
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

/* ─── Inline SVG icons (no external dependency) ───────────────────────────── */
const NAV_ICONS: Partial<Record<MenuCode, React.ReactNode>> = {
  DASHBOARD: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  USERS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  MERCHANTS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  SUPAGO_BANKS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10l9-7 9 7"/><line x1="12" y1="10" x2="12" y2="20"/>
    </svg>
  ),
  BANKS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10l9-7 9 7"/><line x1="12" y1="10" x2="12" y2="20"/>
    </svg>
  ),
  UPI: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  PAYIN: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  ),
  PAYOUT: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  ),
  UTR: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  TRANSACTIONS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  INTER_TRANSFER: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
    </svg>
  ),
  LEDGER: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  COMMISSION: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  REPORTS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  AUDIT: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  SETTINGS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
}

/* ─── Nav section groupings ───────────────────────────────────────────────── */
const SECTION_GROUPS: { label: string; codes: MenuCode[] }[] = [
  { label: 'Operations', codes: ['DASHBOARD', 'PAYIN', 'PAYOUT', 'UTR', 'INTER_TRANSFER', 'MERCHANTS', 'SUPAGO_BANKS'] },
  { label: 'Finance', codes: ['TRANSACTIONS', 'LEDGER', 'COMMISSION', 'REPORTS'] },
  { label: 'Admin', codes: ['USERS', 'BANKS', 'UPI', 'AUDIT', 'SETTINGS'] },
]

const NAV_ORDER = SECTION_GROUPS.flatMap((g) => g.codes)

/* ─── Role display label ──────────────────────────────────────────────────── */
function formatRole(role: UserRole): string {
  return role.replace(/_/g, ' ')
}


/* ─── AppShell ────────────────────────────────────────────────────────────── */
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, refreshUser } = useSession()

  useEffect(() => {
    if (role !== 'ADMIN') return
    void refreshUser().catch(() => undefined)
  }, [role, refreshUser])

  const showDepositLimitStrip = Boolean(user?.daily_deposit_limit_reached)

  const order = NAV_ORDER
  const items = [...menus]
    .filter((row) => row.can_view && HREF[row.menu_code])
    .sort((a, b) => order.indexOf(a.menu_code) - order.indexOf(b.menu_code))
    .map((row) => ({
      href: HREF[row.menu_code] as string,
      label: LABELS[row.menu_code],
      code: row.menu_code,
      extra:
        row.menu_code === 'COMMISSION' && row.can_edit
          ? [{ href: '/commission/config', label: 'Commission Config' }]
          : [],
    }))

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--qp-surface)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`group fixed inset-y-0 left-0 z-30 flex flex-col transition-[width,transform] duration-300 ease-in-out lg:static lg:translate-x-0 overflow-hidden shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-[240px] lg:w-[68px] lg:hover:w-[240px]`}
        style={{ backgroundColor: 'var(--qp-sidebar-bg)', borderRight: '1px solid var(--qp-sidebar-border)' }}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 overflow-hidden" style={{ borderBottom: '1px solid var(--qp-sidebar-border)' }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--qp-primary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="flex flex-col whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
            <p className="text-sm font-bold leading-none" style={{ color: '#ffffff' }}>QuickerPay</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--qp-sidebar-muted)' }}>Console</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-x-hidden overflow-y-auto py-3 px-3 scrollbar-hide">
          {SECTION_GROUPS.map((group) => {
            const groupItems = items.filter((item) => (group.codes as string[]).includes(item.code))
            if (groupItems.length === 0) return null
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-70" style={{ color: 'var(--qp-sidebar-muted)' }}>
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => (
                    <li key={item.href}>
                      <NavItem href={item.href} label={item.label} code={item.code} />
                      {item.extra.map((extra) => (
                        <SubNavItem key={extra.href} href={extra.href} label={extra.label} />
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {isLabConsole() ? (
            <div className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-70" style={{ color: 'var(--qp-sidebar-muted)' }}>
                Lab
              </p>
              <ul className="space-y-0.5">
                <li>
                  <LabNavItem href="/mock/gpay" label="GPay mock" />
                </li>
              </ul>
            </div>
          ) : null}
        </nav>

        {/* Role badge */}
        <div className="px-4 py-3 overflow-hidden whitespace-nowrap" style={{ borderTop: '1px solid var(--qp-sidebar-border)' }}>
          <div className="flex items-center gap-3 h-4">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse ml-0.5" style={{ backgroundColor: 'var(--qp-primary)' }} />
            <span className="text-[11px] font-medium uppercase tracking-wide transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100" style={{ color: 'var(--qp-sidebar-muted)' }}>
              {formatRole(role)}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header
          className="flex h-14 items-center justify-between px-4"
          style={{ backgroundColor: 'var(--qp-card)', borderBottom: '1px solid var(--qp-border)', boxShadow: 'var(--qp-shadow-sm)' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md lg:hidden"
              style={{ color: 'var(--qp-text-secondary)' }}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h1>
          </div>
          <HeaderToggles />
        </header>

        {showDepositLimitStrip ? (
          <div
            role="status"
            aria-live="polite"
            className="px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: 'var(--qp-danger-bg)',
              color: 'var(--qp-danger)',
              borderBottom: '1px solid var(--qp-border)',
            }}
          >
            Daily deposit limit reached. All accounts are deactivated for today.
          </div>
        ) : null}

        {/* Page content */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  )
}

/* ─── NavItem ─────────────────────────────────────────────────────────────── */
function NavItem({ href, label, code }: { href: string; label: string; code: MenuCode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)
  const icon = NAV_ICONS[code]

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150"
      style={{
        color: active ? '#ffffff' : 'var(--qp-sidebar-text)',
        backgroundColor: active ? 'var(--qp-sidebar-active)' : 'transparent',
        borderLeft: active ? '3px solid var(--qp-primary)' : '3px solid transparent',
        paddingLeft: active ? '9px' : '9px',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--qp-sidebar-hover)'
          e.currentTarget.style.color = '#ffffff'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--qp-sidebar-text)'
        }
      }}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="truncate transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">{label}</span>
    </Link>
  )
}

/* ─── LabNavItem ──────────────────────────────────────────────────────────── */
function LabNavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150"
      style={{
        color: active ? '#ffffff' : 'var(--qp-sidebar-text)',
        backgroundColor: active ? 'var(--qp-sidebar-active)' : 'transparent',
        borderLeft: active ? '3px solid var(--qp-primary)' : '3px solid transparent',
        paddingLeft: '9px',
      }}
      aria-label={label}
    >
      <span className="shrink-0 opacity-80">
        <FlaskConical size={18} strokeWidth={1.75} />
      </span>
      <span className="truncate transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">{label}</span>
    </Link>
  )
}

/* ─── SubNavItem ──────────────────────────────────────────────────────────── */
function SubNavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md py-1.5 pl-10 pr-3 text-xs font-medium transition-all duration-150"
      style={{
        color: active ? '#ffffff' : 'var(--qp-sidebar-text)',
        backgroundColor: active ? 'var(--qp-sidebar-active)' : 'transparent',
        opacity: active ? 1 : 0.8,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--qp-sidebar-hover)'
          e.currentTarget.style.color = '#ffffff'
          e.currentTarget.style.opacity = '1'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--qp-sidebar-text)'
          e.currentTarget.style.opacity = '0.8'
        }
      }}
    >
      <span className="shrink-0 text-center w-[18px]" style={{ color: 'var(--qp-primary)' }}>›</span>
      <span className="truncate transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">{label}</span>
    </Link>
  )
}

/* ─── Navigation (kept for backward compat if used elsewhere) ─────────────── */
export function Navigation({ menus, role: _role }: { menus: MenuGrant[]; role: UserRole }) {
  const items = [...menus]
    .filter((row) => row.can_view && HREF[row.menu_code])
    .map((row) => ({
      href: HREF[row.menu_code] as string,
      label: LABELS[row.menu_code],
      code: row.menu_code,
      extra:
        row.menu_code === 'COMMISSION' && row.can_edit
          ? [{ href: '/commission/config', label: 'Commission Config' }]
          : [],
    }))

  return (
    <nav style={{ backgroundColor: 'var(--qp-sidebar-bg)', width: '240px' }}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <NavItem href={item.href} label={item.label} code={item.code} />
          </li>
        ))}
      </ul>
    </nav>
  )
}


