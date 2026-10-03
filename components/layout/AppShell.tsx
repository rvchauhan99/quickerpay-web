'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { PANEL_BANK_CONSOLE_ENABLED, type CriciConnectionAlertItem, type MenuCode, type MenuGrant, type UserRole } from '@quickerpay/shared-types'
import { BrandLockup } from '@/components/brand/BrandLockup'
import { HeaderToggles } from './HeaderToggles'
import { apiRequest } from '@/lib/api'
import { roleLabel } from '@/lib/labels'
import { isLabConsole, isMockGpayAllowed } from '@/lib/lab'
import { hasMenu, useSession } from '@/lib/session'
import { FlaskConical, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'qp.ui.sidebarCollapsed'

/* ─── Nav metadata ─────────────────────────────────────────────────────────── */
const LABELS: Record<MenuCode, string> = {
  DASHBOARD: 'Dashboard',
  USERS: 'User Management',
  MERCHANTS: 'Exchange Master',
  BANKS: 'Bank Account',
  UPI: 'UPI',
  PAYIN: 'Pending Deposit',
  PAYOUT: 'Pending Withdrawal',
  UTR: 'Banker UTR Entries',
  TRANSACTIONS: 'Transactions',
  INTER_TRANSFER: 'Hawala',
  HAWALA: 'Hawala',
  PARTIES: 'Party Master',
  LEDGER: 'Ledger',
  COMMISSION: 'Commission',
  REPORTS: 'Reports',
  AUDIT: 'Audit',
  SETTINGS: 'Settings',
  GENERAL: 'General',
  SUPPORT: 'Support',
  SUPAGO_BANKS: 'Supago Banks',
  CRICI_BANKS: 'Crici Banks',
}

const HREF: Partial<Record<MenuCode, string>> = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  MERCHANTS: '/merchants',
  SUPAGO_BANKS: '/supago-banks',
  CRICI_BANKS: '/crici-banks',
  BANKS: '/banks',
  UPI: '/upi',
  PAYIN: '/payin',
  PAYOUT: '/payout',
  UTR: '/utr',
  LEDGER: '/ledger',
  COMMISSION: '/commission',
  HAWALA: '/hawala',
  PARTIES: '/parties',
  TRANSACTIONS: '/transactions',
  REPORTS: '/reports',
  AUDIT: '/audit',
  SETTINGS: '/settings',
  GENERAL: '/general',
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
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  SUPAGO_BANKS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10l9-7 9 7"/><line x1="12" y1="10" x2="12" y2="20"/>
    </svg>
  ),
  CRICI_BANKS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10l9-7 9 7"/><line x1="12" y1="10" x2="12" y2="20"/>
    </svg>
  ),
  BANKS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>
    </svg>
  ),
  UPI: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  PAYIN: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  PAYOUT: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  UTR: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  TRANSACTIONS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  HAWALA: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  PARTIES: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>
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
  GENERAL: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><line x1="6.5" y1="8" x2="6.5" y2="8.01"/><line x1="17.5" y1="8" x2="17.5" y2="8.01"/>
    </svg>
  ),
}

/* ─── Nav section groupings ───────────────────────────────────────────────── */
/**
 * Primary rail — FastTag-exact order/labels (UI only; menu codes/RBAC unchanged).
 * Banker opens a floating card sheet (same chrome as More). Duplicate PAYIN/PAYOUT use query hrefs.
 */
type PrimaryLink = {
  key: string
  code: MenuCode
  label: string
  href: string
  /** When set, only these roles see the link (still requires menu can_view). */
  roles?: UserRole[]
  /** Extra menu action beyond can_view. */
  requireCreate?: boolean
}

const PRIMARY_LINKS: PrimaryLink[] = [
  { key: 'dashboard', code: 'DASHBOARD', label: 'Dashboard', href: '/dashboard' },
  { key: 'exchange', code: 'MERCHANTS', label: 'Exchange Master', href: '/merchants' },
  { key: 'parties', code: 'PARTIES', label: 'Party Master', href: '/parties' },
  { key: 'pending-deposit', code: 'PAYIN', label: 'Pending Deposit', href: '/payin' },
  {
    key: 'payin-injection',
    code: 'PAYIN',
    label: 'Payin Injection',
    href: '/payin?inject=1',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    requireCreate: true,
  },
  { key: 'pending-withdrawal', code: 'PAYOUT', label: 'Pending Withdrawal', href: '/payout?status=INITIATE' },
  { key: 'in-process-withdrawal', code: 'PAYOUT', label: 'In Process Withdrawal', href: '/payout?status=INITIATE&assigned=true' },
  { key: 'hawala', code: 'HAWALA', label: 'Hawala', href: '/hawala' },
  { key: 'general', code: 'GENERAL', label: 'General', href: '/general' },
]

/** Per-link icon overrides where one MenuCode maps to two primary rows. */
const PRIMARY_LINK_ICONS: Record<string, React.ReactNode> = {
  'in-process-withdrawal': (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  'payin-injection': (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
}

const BANKER_PARENT_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>
  </svg>
)

const BANKER_CHILD_LINKS: PrimaryLink[] = [
  { key: 'bank-account', code: 'BANKS', label: 'Bank Account', href: '/banks' },
  { key: 'banker-utr', code: 'UTR', label: 'Banker UTR Entries', href: '/utr' },
]

/** More sheet — everything not on the FastTag primary rail. */
const MORE_SECTION_GROUPS: { label: string; codes: MenuCode[] }[] = [
  { label: 'Finance', codes: ['TRANSACTIONS', 'LEDGER', 'COMMISSION', 'REPORTS'] },
  { label: 'Banking', codes: ['UPI'] },
  { label: 'Admin', codes: ['USERS'] },
  { label: 'Panel banks', codes: ['SUPAGO_BANKS', 'CRICI_BANKS'] },
  { label: 'System', codes: ['AUDIT', 'SETTINGS'] },
]

const MORE_CODES = new Set(MORE_SECTION_GROUPS.flatMap((g) => g.codes))
const NAV_ORDER = [
  ...PRIMARY_LINKS.map((l) => l.code),
  'BANKS',
  'UTR',
  ...MORE_SECTION_GROUPS.flatMap((g) => g.codes),
] as MenuCode[]

function panelBankNavVisible(code: MenuCode): boolean {
  if (PANEL_BANK_CONSOLE_ENABLED) return true
  return code !== 'SUPAGO_BANKS' && code !== 'CRICI_BANKS'
}

function isBankerPath(pathname: string): boolean {
  return (
    pathname === '/bankers' ||
    pathname.startsWith('/bankers/') ||
    pathname === '/banks' ||
    pathname.startsWith('/banks/') ||
    pathname === '/utr' ||
    pathname.startsWith('/utr/')
  )
}

function isMorePath(pathname: string): boolean {
  if (pathname.startsWith('/mock/gpay')) return true
  if (pathname.startsWith('/commission')) return true
  if (pathname === '/upi' || pathname.startsWith('/upi/')) return true
  if (pathname === '/users' || pathname.startsWith('/users/')) return true
  for (const code of MORE_CODES) {
    if (code === 'UPI' || code === 'USERS') continue
    const href = HREF[code]
    if (!href) continue
    if (pathname === href || pathname.startsWith(`${href}/`)) return true
  }
  return false
}

function hrefIsActive(href: string, pathname: string, search: string): boolean {
  const url = new URL(href, 'http://qp.local')
  const pathOk = pathname === url.pathname || pathname.startsWith(`${url.pathname}/`)
  if (!pathOk) return false
  const want = url.searchParams
  const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (url.pathname === '/payin') {
    const wantInject = want.get('inject') === '1'
    const haveInject = have.get('inject') === '1'
    return wantInject === haveInject
  }
  if (url.pathname === '/payout') {
    const wantStatus = want.get('status') ?? 'INITIATE'
    const haveStatus = have.get('status') ?? 'INITIATE'
    if (wantStatus !== haveStatus) return false
    const wantAssigned = want.get('assigned') === 'true'
    const haveAssigned = have.get('assigned') === 'true'
    return wantAssigned === haveAssigned
  }
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false
  }
  return true
}

/* ─── Role display label ──────────────────────────────────────────────────── */
function formatRole(role: UserRole): string {
  return roleLabel(role)
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  const router = useRouter()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [moreExpanded, setMoreExpanded] = useState(false)
  const [bankerExpanded, setBankerExpanded] = useState(false)
  const [criciAlerts, setCriciAlerts] = useState<CriciConnectionAlertItem[]>([])
  const { user, accessToken, refreshUser } = useSession()

  useEffect(() => {
    if (isBankerPath(pathname)) setBankerExpanded(true)
    if (isMorePath(pathname)) setMoreExpanded(true)
  }, [pathname])

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
    } catch {
      setCollapsed(false)
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Private mode — keep in-memory state only.
      }
      return next
    })
  }

  useEffect(() => {
    if (!user?.require_password_change) return
    if (pathname === '/profile' || pathname.startsWith('/profile/')) return
    router.replace('/profile')
  }, [user?.require_password_change, pathname, router])

  useEffect(() => {
    if (role !== 'BANKER') return
    void refreshUser().catch(() => undefined)
  }, [role, refreshUser])

  useEffect(() => {
    if (role !== 'SUPER_ADMIN' || !accessToken) {
      setCriciAlerts([])
      return
    }
    let cancelled = false
    const loadAlerts = async () => {
      try {
        const reply = await apiRequest<{ items: CriciConnectionAlertItem[] }>(
          '/api/v1/crici/connection-alerts',
          { token: accessToken },
        )
        if (!cancelled) setCriciAlerts(reply.items ?? [])
      } catch {
        if (!cancelled) setCriciAlerts([])
      }
    }
    void loadAlerts()
    const timer = setInterval(() => {
      void loadAlerts()
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [role, accessToken])

  const showDepositLimitStrip = Boolean(user?.daily_deposit_limit_reached)
  const showCriciReconnectStrip = role === 'SUPER_ADMIN' && criciAlerts.length > 0

  const order = NAV_ORDER
  const forcePasswordChange = Boolean(user?.require_password_change)
  const items = forcePasswordChange
    ? []
    : [...menus]
        .filter((row) => row.can_view && HREF[row.menu_code] && panelBankNavVisible(row.menu_code))
        .sort((a, b) => order.indexOf(a.menu_code) - order.indexOf(b.menu_code))
        .map((row) => ({
          href: HREF[row.menu_code] as string,
          label: LABELS[row.menu_code],
          code: row.menu_code,
        }))

  const moreItems = items.filter((item) => MORE_CODES.has(item.code))
  const showLabInMore = isLabConsole() && role !== 'MERCHANT' && !forcePasswordChange
  const showMockGpay = isMockGpayAllowed() && role !== 'MERCHANT' && !forcePasswordChange
  const showMoreButton = !forcePasswordChange && (moreItems.length > 0 || showLabInMore || showMockGpay)
  const moreActive = isMorePath(pathname)
  const bankerActive = isBankerPath(pathname)
  const canView = (code: MenuCode) =>
    !forcePasswordChange && menus.some((grant) => grant.menu_code === code && grant.can_view && panelBankNavVisible(code))
  const showBankerMaster =
    role === 'SUPER_ADMIN' && !forcePasswordChange && menus.some((grant) => grant.menu_code === 'USERS' && grant.can_view)
  const bankerChildren = BANKER_CHILD_LINKS.filter((link) => canView(link.code))
  const showBankerGroup = showBankerMaster || bankerChildren.length > 0

  const renderNavGroups = (
    groups: { label: string; codes: MenuCode[] }[],
    options?: { onNavigate?: () => void; tone?: 'rail' | 'sheet' },
  ) => {
    const tone = options?.tone ?? 'rail'
    return groups.map((group) => {
      const groupItems = items.filter((item) => (group.codes as string[]).includes(item.code))
      if (groupItems.length === 0) return null
      return (
        <ul key={group.label} className="space-y-px">
          {groupItems.map((item) => {
            const nav = options?.onNavigate ? (
              <NavItem href={item.href} label={item.label} code={item.code} onNavigate={options.onNavigate} tone={tone} />
            ) : (
              <NavItem href={item.href} label={item.label} code={item.code} tone={tone} />
            )
            return (
              <li key={item.href}>
                {nav}
              </li>
            )
          })}
        </ul>
      )
    })
  }

  const renderPrimaryLink = (link: PrimaryLink, onNavigate?: () => void) => {
    if (!canView(link.code)) return null
    if (link.roles && !link.roles.includes(role)) return null
    if (link.requireCreate && !hasMenu(menus, link.code, 'can_create')) return null
    const icon = PRIMARY_LINK_ICONS[link.key]
    return (
      <li key={link.key}>
        {onNavigate ? (
          <NavItem
            href={link.href}
            label={link.label}
            code={link.code}
            active={hrefIsActive(link.href, pathname, search)}
            {...(icon !== undefined ? { icon } : {})}
            onNavigate={onNavigate}
          />
        ) : (
          <NavItem
            href={link.href}
            label={link.label}
            code={link.code}
            active={hrefIsActive(link.href, pathname, search)}
            {...(icon !== undefined ? { icon } : {})}
          />
        )}
      </li>
    )
  }

  const renderPrimaryNav = (onNavigate?: () => void) => (
    <ul className="space-y-px">
      {renderPrimaryLink(PRIMARY_LINKS[0]!, onNavigate)}
      {renderPrimaryLink(PRIMARY_LINKS[1]!, onNavigate)}
      {showBankerGroup ? (
        <li className="flex flex-col gap-px">
          <button
            type="button"
            onClick={() => {
              if (collapsed && !bankerExpanded) toggleCollapsed()
              setBankerExpanded((prev) => !prev)
            }}
            data-active={bankerActive ? 'true' : 'false'}
            className="qp-nav-item flex h-8 w-full items-center gap-2 rounded-qp px-2.5 text-[12.5px] font-medium transition-colors duration-150"
            style={navItemStyle(bankerActive, 'rail')}
            aria-label={bankerExpanded ? 'Close Banker modules' : 'Open Banker modules'}
            aria-expanded={bankerExpanded}
          >
            <span className="shrink-0 opacity-80">{BANKER_PARENT_ICON}</span>
            <span className={`truncate ${SIDE_LABEL}`}>Banker</span>
            <span className={`ml-auto shrink-0 opacity-60 transition-transform duration-200 ${bankerExpanded ? 'rotate-90' : ''} ${SIDE_LABEL}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </button>
          {bankerExpanded && !collapsed ? (
            <ul className="mt-1 space-y-px pl-2 pb-1 border-l-2 border-[var(--qp-sidebar-border)] ml-4">
              {showBankerMaster ? (
                <li>
                  <BankerMasterNavItem
                    {...(onNavigate ? { onNavigate } : {})}
                    tone="rail"
                  />
                </li>
              ) : null}
              {bankerChildren.map((link) => (
                <li key={link.key}>
                  <NavItem
                    href={link.href}
                    label={link.label}
                    code={link.code}
                    tone="rail"
                    {...(onNavigate ? { onNavigate } : {})}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ) : null}
      {PRIMARY_LINKS.slice(2).map((link) => renderPrimaryLink(link, onNavigate))}

      {showMoreButton ? (
        <li className="flex flex-col gap-px mt-4 pt-2 border-t border-[var(--qp-sidebar-border)]">
          <button
            type="button"
            onClick={() => {
              if (collapsed && !moreExpanded) toggleCollapsed()
              setMoreExpanded((prev) => !prev)
            }}
            data-active={moreActive ? 'true' : 'false'}
            className="qp-nav-item flex h-8 w-full items-center gap-2 rounded-qp px-2.5 text-[12.5px] font-medium transition-colors duration-150"
            style={navItemStyle(moreActive, 'rail')}
            aria-label={moreExpanded ? 'Close More modules' : 'Open More modules'}
            aria-expanded={moreExpanded}
          >
            <span className="shrink-0 opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </span>
            <span className={`truncate ${SIDE_LABEL}`}>More</span>
            <span className={`ml-auto shrink-0 opacity-60 transition-transform duration-200 ${moreExpanded ? 'rotate-90' : ''} ${SIDE_LABEL}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </button>
          {moreExpanded && !collapsed ? (
            <div className="mt-2 pl-2 border-l-2 border-[var(--qp-sidebar-border)] ml-4 pb-2">
              <div className="flex flex-col gap-px">
                {renderNavGroups(MORE_SECTION_GROUPS, {
                  ...(onNavigate ? { onNavigate } : {}),
                  tone: 'rail',
                })}
                {showMockGpay ? (
                  <ul className="space-y-px">
                    <li>
                      <LabNavItem
                        href="/mock/gpay"
                        label="GPay mock"
                        {...(onNavigate ? { onNavigate } : {})}
                        tone="rail"
                      />
                    </li>
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </li>
      ) : null}
    </ul>
  )

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
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`group/side fixed inset-y-0 left-0 z-30 flex w-qp-sidebar shrink-0 flex-col overflow-hidden transition-[width,transform] duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-qp-rail' : 'lg:w-qp-sidebar'}`}
        style={{ backgroundColor: 'var(--qp-sidebar-bg)', borderRight: '1px solid var(--qp-sidebar-border)' }}
      >
        {/* Logo */}
        <div className="flex h-qp-header shrink-0 items-center overflow-hidden px-3" style={{ borderBottom: '1px solid var(--qp-sidebar-border)' }}>
          <BrandLockup
            size="sm"
            tone="dark"
            subtitle="Console"
            copyClassName={SIDE_LABEL}
          />
        </div>

        {/* Primary nav — FastTag order; Banker opens floating sheet between Exchange Master and Party Master */}
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-2 scrollbar-hide" aria-label="Main">
          {renderPrimaryNav(() => setSidebarOpen(false))}
        </nav>

        {/* User Role */}
        <div className="shrink-0 overflow-hidden" style={{ borderTop: '1px solid var(--qp-sidebar-border)' }}>
          <div className="flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap px-3 py-3">
            <div className={`flex min-w-0 items-center gap-2 ${collapsed ? 'lg:hidden' : ''}`}>
              <div className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse" style={{ backgroundColor: 'var(--qp-primary)' }} />
              <span className="truncate text-[10.5px] font-medium uppercase tracking-wide" style={{ color: 'var(--qp-sidebar-muted)' }}>
                {formatRole(role)}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-qp transition-colors hover:bg-[var(--qp-sidebar-hover)] lg:flex"
              style={{ color: 'var(--qp-sidebar-muted)' }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex h-qp-header shrink-0 items-center justify-between px-qp-page"
          style={{ backgroundColor: 'var(--qp-card)', borderBottom: '1px solid var(--qp-border)' }}
        >
          <div className="flex items-center gap-2">
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
            <h1 className="text-[13px] font-semibold" style={{ color: 'var(--qp-text-primary)' }}>{title}</h1>
          </div>
          <HeaderToggles />
        </header>

        {forcePasswordChange ? (
          <div
            role="alert"
            aria-live="polite"
            className="px-qp-page py-1 text-xs font-medium"
            style={{
              backgroundColor: 'var(--qp-warning-bg)',
              color: 'var(--qp-warning)',
              borderBottom: '1px solid var(--qp-border)',
            }}
          >
            You must change your temporary password before using the console.
          </div>
        ) : null}

        {showDepositLimitStrip ? (
          <div
            role="status"
            aria-live="polite"
            className="px-qp-page py-1 text-xs font-medium"
            style={{
              backgroundColor: 'var(--qp-danger-bg)',
              color: 'var(--qp-danger)',
              borderBottom: '1px solid var(--qp-border)',
            }}
          >
            Daily deposit limit reached. All accounts are deactivated for today.
          </div>
        ) : null}

        {showCriciReconnectStrip ? (
          <div
            role="alert"
            aria-live="polite"
            className="px-qp-page py-1 text-xs font-medium"
            style={{
              backgroundColor: 'var(--qp-warning-bg)',
              color: 'var(--qp-warning)',
              borderBottom: '1px solid var(--qp-border)',
            }}
          >
            <span className="font-semibold">Crici reconnect required:</span>{' '}
            {criciAlerts.map((alert, index) => (
              <span key={alert.merchant_id}>
                {index > 0 ? ', ' : null}
                <Link
                  href={`/merchants/${alert.merchant_id}`}
                  className="underline underline-offset-2"
                  style={{ color: 'inherit' }}
                >
                  {alert.merchant_code}
                </Link>
                {alert.requires_2fa ? ' (2FA)' : null}
              </span>
            ))}
            . Paste a fresh Google Authenticator code on the Exchange Master.
          </div>
        ) : null}

        {/* Page content */}
        <main className="min-w-0 flex-1 p-qp-page">{children}</main>
      </div>
    </div>
  )
}

const SIDE_LABEL = 'group-data-[collapsed=true]/side:lg:hidden'

type NavTone = 'rail' | 'sheet'



function navItemStyle(active: boolean, tone: NavTone): CSSProperties {
  if (tone === 'sheet') {
    return {
      color: active ? 'var(--qp-primary)' : 'var(--qp-text-primary)',
      backgroundColor: active ? 'var(--qp-accent-bg)' : 'transparent',
      borderLeft: active ? '3px solid var(--qp-primary)' : '3px solid transparent',
      paddingLeft: '7px',
    }
  }
  return {
    color: active ? 'var(--qp-sidebar-active-text)' : 'var(--qp-sidebar-text)',
    backgroundColor: active ? 'var(--qp-sidebar-active)' : 'transparent',
    borderLeft: active ? '3px solid var(--qp-primary)' : '3px solid transparent',
    paddingLeft: '7px',
  }
}

/* ─── NavItem ─────────────────────────────────────────────────────────────── */
function NavItem({
  href,
  label,
  code,
  onNavigate,
  tone = 'rail',
  active: activeProp,
  icon: iconProp,
}: {
  href: string
  label: string
  code: MenuCode
  onNavigate?: () => void
  tone?: NavTone
  active?: boolean
  icon?: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  const active = activeProp ?? hrefIsActive(href, pathname, search)
  const icon = iconProp ?? NAV_ICONS[code]

  return (
    <Link
      href={href}
      data-active={active ? 'true' : 'false'}
      onClick={() => onNavigate?.()}
      className="qp-nav-item flex h-8 items-center gap-2 rounded-qp px-2.5 text-[12.5px] font-medium transition-colors duration-150"
      style={navItemStyle(active, tone)}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className={`truncate ${tone === 'rail' ? SIDE_LABEL : ''}`}>{label}</span>
    </Link>
  )
}

/* ─── Banker Master (in Banker sheet; reuse USERS gate, not a menu code) ───── */
function BankerMasterNavItem({ onNavigate, tone = 'sheet' }: { onNavigate?: () => void; tone?: NavTone }) {
  const pathname = usePathname()
  const active = pathname === '/bankers' || pathname.startsWith('/bankers/')

  return (
    <Link
      href="/bankers"
      data-active={active ? 'true' : 'false'}
      onClick={() => onNavigate?.()}
      className="qp-nav-item flex h-8 items-center gap-2 rounded-qp px-2.5 text-[12.5px] font-medium transition-colors duration-150"
      style={navItemStyle(active, tone)}
      aria-label="Banker Master"
    >
      <span className="shrink-0 opacity-80">{NAV_ICONS.USERS}</span>
      <span className="truncate">Banker Master</span>
    </Link>
  )
}

/* ─── LabNavItem ──────────────────────────────────────────────────────────── */
function LabNavItem({
  href,
  label,
  onNavigate,
  tone = 'rail',
}: {
  href: string
  label: string
  onNavigate?: () => void
  tone?: NavTone
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className="flex h-8 items-center gap-2 rounded-qp px-2.5 text-[12.5px] font-medium transition-colors duration-150"
      style={navItemStyle(active, tone)}
      aria-label={label}
    >
      <span className="shrink-0 opacity-80">
        <FlaskConical size={16} strokeWidth={1.75} />
      </span>
      <span className={`truncate ${tone === 'rail' ? SIDE_LABEL : ''}`}>{label}</span>
    </Link>
  )
}



/* ─── Navigation (kept for backward compat if used elsewhere) ─────────────── */
export function Navigation({ menus, role: _role }: { menus: MenuGrant[]; role: UserRole }) {
  const items = [...menus]
    .filter((row) => row.can_view && HREF[row.menu_code] && panelBankNavVisible(row.menu_code))
    .map((row) => ({
      href: HREF[row.menu_code] as string,
      label: LABELS[row.menu_code],
      code: row.menu_code,
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


