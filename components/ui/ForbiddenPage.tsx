export function ForbiddenPage({ permission }: { permission: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {/* Icon */}
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--qp-danger-bg)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--qp-danger)' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <h1 className="mb-1 text-2xl font-bold" style={{ color: 'var(--qp-text-primary)' }}>Access Denied</h1>
      <p className="mb-4 text-sm" style={{ color: 'var(--qp-text-secondary)' }}>
        You do not have the <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: 'var(--qp-danger-bg)', color: 'var(--qp-danger)' }}>{permission}</span> permission.
      </p>
      <p className="max-w-xs text-xs" style={{ color: 'var(--qp-text-muted)' }}>
        Ask a Super Admin to grant access to this menu if you need it.
      </p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--qp-primary)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to Dashboard
      </a>
    </main>
  )
}
