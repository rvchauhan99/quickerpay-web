'use client'

import { useEffect, type ReactNode } from 'react'

const SIZE_MAX_WIDTH: Record<'md' | 'lg' | 'xl', string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

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
  size = 'md',
}: {
  title: string
  ariaLabel?: string
  children: ReactNode
  footer: ReactNode
  /** Panel max width. Default md keeps existing dialogs unchanged. */
  size?: 'md' | 'lg' | 'xl'
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
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
    >
      <div className="flex min-h-[calc(100dvh-1.5rem)] items-center justify-center sm:min-h-[calc(100dvh-2rem)]">
        <div
          className={`flex w-full ${SIZE_MAX_WIDTH[size]} max-h-[calc(100dvh-1.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border sm:max-h-[calc(100dvh-2rem)]`}
          style={{
            backgroundColor: 'var(--qp-card)',
            borderColor: 'var(--qp-border)',
            boxShadow: 'var(--qp-shadow-lg)',
          }}
        >
          <div className="shrink-0 border-b px-4 pb-3 pt-5 sm:px-6 sm:pt-6" style={{ borderColor: 'var(--qp-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              {title}
            </h3>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            tabIndex={0}
            aria-label={`${ariaLabel ?? title} content`}
          >
            {children}
          </div>
          <div
            className="flex shrink-0 justify-end gap-2 border-t px-4 py-4 sm:px-6"
            style={{ borderColor: 'var(--qp-border)' }}
          >
            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
