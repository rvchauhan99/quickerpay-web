const buildSteps = [
  { step: 1, name: 'Tenancy foundation', status: 'done' },
  { step: 2, name: 'Auth, sessions, five roles, menus, audit', status: 'done' },
  { step: 3, name: 'Users and scope grants', status: 'next' },
  { step: 4, name: 'Banking: accounts, UPI, limits', status: 'not started' },
  { step: 5, name: 'Ledger and FinancialPostingService', status: 'not started' },
] as const

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">QuickerPay</h1>
      <p className="mt-2 text-sm text-slate-600">
        This is the Admin and Platform UI. Screens are specified in{' '}
        <code>quickerpay-api/docs/03_MODULES_AND_SCREENS.md</code> and are built from step 10.
        Progress lives in <code>quickerpay-api/PROGRESS.md</code>.
      </p>

      <ol className="mt-8 space-y-2">
        {buildSteps.map((item) => (
          <li
            key={item.step}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium text-slate-500">{item.step}.</span> {item.name}
            </span>
            <span
              className="text-xs uppercase tracking-wide text-slate-400"
              data-status={item.status}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}
