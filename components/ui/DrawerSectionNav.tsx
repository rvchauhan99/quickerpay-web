/* ─── DrawerSectionNav ────────────────────────────────────────────────────────
   Compact ERP left rail for Advanced Settings-style drawers.
   Usage:
     <DrawerSectionNav
       sections={[{ id: 'contacts', label: 'Contacts' }]}
       activeId={active}
       onChange={setActive}
     />
──────────────────────────────────────────────────────────────────────────── */

export type DrawerSectionNavItem = {
  id: string
  label: string
  badge?: string
}

export function DrawerSectionNav({
  sections,
  activeId,
  onChange,
}: {
  sections: DrawerSectionNavItem[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <nav aria-label="Advanced settings sections" className="flex flex-col gap-0.5 p-2">
      {sections.map((section) => {
        const active = section.id === activeId
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={active ? 'page' : undefined}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qp-primary)]"
            style={{
              backgroundColor: active ? 'var(--qp-primary-muted, #eff6ff)' : 'transparent',
              color: active ? 'var(--qp-primary-dark)' : 'var(--qp-text)',
            }}
          >
            <span className="min-w-0 truncate">{section.label}</span>
            {section.badge ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: active ? 'var(--qp-primary)' : 'var(--qp-border)',
                  color: active ? '#fff' : 'var(--qp-text-muted)',
                }}
              >
                {section.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
