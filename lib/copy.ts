/* ─── Clipboard helper ───────────────────────────────────────────────────────
   Returns false when the value is empty, a placeholder dash, or write fails.
   Falls back to a textarea + execCommand when Clipboard API is blocked.
──────────────────────────────────────────────────────────────────────────── */
export async function copyText(value: string): Promise<boolean> {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return false
  try {
    await navigator.clipboard.writeText(trimmed)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = trimmed
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}
