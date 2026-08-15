export function ForbiddenPage({ permission }: { permission: string }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-sm text-zinc-700">
      <h1 className="text-lg font-semibold text-zinc-900">403</h1>
      <p className="mt-2">
        You do not have <code className="rounded bg-zinc-100 px-1">{permission}</code>. Ask a Super Admin to grant
        the menu if you need this screen.
      </p>
    </main>
  )
}
