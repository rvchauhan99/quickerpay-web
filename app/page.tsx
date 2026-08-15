const buildSteps = [
  { step: 1, name: 'Tenancy foundation', status: 'done' },
  { step: 2, name: 'Auth, sessions, five roles, menus, audit', status: 'done' },
  { step: 3, name: 'Users and scope grants', status: 'done' },
  { step: 4, name: 'Banking: accounts, UPI, limits', status: 'done' },
  { step: 5, name: 'Ledger and FinancialPostingService', status: 'done' },
  { step: 6, name: 'Pay-In and UTR', status: 'done' },
  { step: 7, name: 'Commission engine and screens', status: 'done' },
  { step: 8, name: 'Pay-Out', status: 'done' },
  { step: 9, name: 'Inter Transfer', status: 'done' },
  { step: 10, name: 'Phase 1 console: dashboard, ledger, transactions', status: 'done' },
] as const

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">QuickerPay</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sign in at <a className="underline" href="/login">/login</a>. The console starts at{' '}
        <a className="underline" href="/dashboard">/dashboard</a>.
      </p>
      <ol className="mt-8 space-y-2">
        {buildSteps.map((item) => (
          <li
            key={item.step}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium text-zinc-500">{item.step}.</span> {item.name}
            </span>
            <span className="text-xs uppercase tracking-wide text-zinc-400">{item.status}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
