'use client'

import Link from 'next/link'

export default function PlatformNewTenantPage() {
  return (
    <main className="mx-auto max-w-lg p-6 text-sm">
      <h1 className="mb-2 text-sm font-semibold">Create tenant</h1>
      <p className="mb-2 text-xs text-zinc-600">
        Provisioning creates a database and Super Admin. That path is the CLI so a half-built Tenant cannot stay ACTIVE.
      </p>
      <pre className="mb-3 overflow-x-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">pnpm provision:tenant your-slug</pre>
      <p className="text-xs">
        <Link className="underline" href="/platform/tenants">
          Back to tenants
        </Link>
      </p>
    </main>
  )
}
