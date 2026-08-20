'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/copy'

/* ─── CopyButton ─────────────────────────────────────────────────────────────
   Theme-matched icon control for copying a single field value to the clipboard.
──────────────────────────────────────────────────────────────────────────── */
export function CopyButton({
  value,
  label,
  className = '',
}: {
  value: string | null | undefined
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const text = (value ?? '').trim()
  const disabled = !text || text === '—'

  const handleClick = async () => {
    if (disabled) return
    const ok = await copyText(text)
    if (!ok) {
      toast.error('Could not copy')
      return
    }
    toast.success('Copied')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handleClick()}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        borderColor: 'var(--qp-border)',
        color: copied ? 'var(--qp-primary)' : 'var(--qp-text-secondary)',
        backgroundColor: '#fff',
      }}
      aria-label={label}
    >
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
    </button>
  )
}
