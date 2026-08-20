/* ─── Clipboard helper ───────────────────────────────────────────────────────
   Returns false when the value is empty, a placeholder dash, or write fails.
──────────────────────────────────────────────────────────────────────────── */
export async function copyText(value: string): Promise<boolean> {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return false
  try {
    await navigator.clipboard.writeText(trimmed)
    return true
  } catch {
    return false
  }
}
