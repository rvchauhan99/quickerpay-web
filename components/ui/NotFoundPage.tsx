export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--qp-primary-light)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--qp-primary)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>

      <h1 className="mb-1 text-2xl font-bold" style={{ color: 'var(--qp-text-primary)' }}>Page not found</h1>
      <p className="max-w-xs text-sm" style={{ color: 'var(--qp-text-secondary)' }}>
        This page does not exist or is not available.
      </p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--qp-primary)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to menu
      </a>
    </main>
  )
}
