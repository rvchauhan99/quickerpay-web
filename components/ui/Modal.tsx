'use client'

import { useEffect, type ReactNode } from 'react'

/* ─── Modal ───────────────────────────────────────────────────────────────────
   Viewport-capped dialog shell: sticky title + footer, scrollable body.
   Overlay also scrolls as a fallback when the panel is taller than the viewport
   (flex min-height:auto otherwise clips without a scroll region).
──────────────────────────────────────────────────────────────────────────── */
export function Modal({
  title,
  ariaLabel,
  children,
  footer,
}: {
  title: string
  ariaLabel?: string
  children: ReactNode
  footer: ReactNode
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
    >
      <div className="flex min-h-[calc(100dvh-2rem)] items-center justify-center">
        <div
          className="flex w-full max-w-md max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden rounded-2xl border"
          style={{
            backgroundColor: 'var(--qp-card)',
            borderColor: 'var(--qp-border)',
            boxShadow: 'var(--qp-shadow-lg)',
          }}
        >
          <div className="shrink-0 border-b px-6 pb-3 pt-6" style={{ borderColor: 'var(--qp-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              {title}
            </h3>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            tabIndex={0}
            aria-label={`${ariaLabel ?? title} content`}
          >
            {children}
          </div>
          <div
            className="flex shrink-0 justify-end gap-2 border-t px-6 py-4"
            style={{ borderColor: 'var(--qp-border)' }}
          >
            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
