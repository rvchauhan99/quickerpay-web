'use client'

import { ScanSearch } from 'lucide-react'

/**
 * Prominent animated status while hosted-pay OCR reads a screenshot.
 * CSS-only — no extra deps.
 */
export function OcrScanningLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex w-full flex-col items-center gap-3 rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white px-4 py-4 shadow-sm"
    >
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-inner">
        <ScanSearch className="h-8 w-8 text-blue-600" strokeWidth={2} aria-hidden />
        <span
          className="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-90 shadow-[0_0_10px_rgba(37,99,235,0.85)] animate-ocr-scan"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-400/10 via-transparent to-blue-400/10 animate-pulse"
          aria-hidden
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-semibold tracking-tight text-blue-900">Fetching UTR from image</p>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600/80">
          <span>Please wait</span>
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 animate-ocr-dot rounded-full bg-blue-500 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-ocr-dot rounded-full bg-blue-500 [animation-delay:160ms]" />
            <span className="h-1 w-1 animate-ocr-dot rounded-full bg-blue-500 [animation-delay:320ms]" />
          </span>
        </p>
      </div>
    </div>
  )
}
