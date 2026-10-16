import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Optional left rail (e.g. DrawerSectionNav). Body becomes rail | scrollable panel. */
  aside?: React.ReactNode
  children: React.ReactNode
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

export function Drawer({ isOpen, onClose, title, size = 'md', aside, children }: DrawerProps) {
  const [isRendered, setIsRendered] = useState(isOpen)

  useEffect(() => {
    if (isOpen) setIsRendered(true)
  }, [isOpen])

  const handleAnimationEnd = () => {
    if (!isOpen) setIsRendered(false)
  }

  if (!isRendered) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      aria-labelledby="drawer-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative flex h-full w-full flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${sizeClasses[size]} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onTransitionEnd={handleAnimationEnd}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--qp-border)' }}
        >
          <h2 id="drawer-title" className="text-lg font-medium" style={{ color: 'var(--qp-text)' }}>
            {title}
          </h2>
          <button
            type="button"
            className="rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--qp-primary)]"
            style={{ color: 'var(--qp-text-muted)' }}
            onClick={onClose}
          >
            <span className="sr-only">Close panel</span>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {aside ? (
          <div className="flex min-h-0 flex-1">
            <aside
              className="w-40 shrink-0 overflow-y-auto border-r sm:w-44"
              style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-surface-muted, #f9fafb)' }}
            >
              {aside}
            </aside>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        )}
      </div>
    </div>
  )
}
