export default function HomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--qp-surface)' }}
    >
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--qp-primary)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-none" style={{ color: 'var(--qp-text-primary)' }}>QuickerPay</h1>
          <p className="text-[11px] uppercase tracking-widest font-medium" style={{ color: 'var(--qp-primary)' }}>
            Payment Operations Console
          </p>
        </div>
      </div>

      {/* Tagline */}
      <p className="mb-8 max-w-sm text-center text-base" style={{ color: 'var(--qp-text-muted)' }}>
        Secure, multi-tenant payment gateway management platform with real-time UTR verification.
      </p>

      {/* CTA */}
      <a
        href="/login"
        className="flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-all duration-150"
        style={{ backgroundColor: 'var(--qp-primary)' }}
      >
        Sign in to Console
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </a>

      {/* Status badge */}
      <div className="mt-8 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: 'var(--qp-success-bg)', color: '#065f46' }}
        >
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--qp-success)' }} />
          All systems operational
        </span>
      </div>
    </main>
  )
}
