import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { brandName } from '@/lib/brand'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: brandName(),
  description: 'Secure multi-tenant payment operations platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Extensions (e.g. QuillBot `data-qb-installed`) mutate <html>/<body> before hydrate.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className="min-h-screen bg-qp-surface font-inter text-slate-900 antialiased"
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </body>
    </html>
  )
}
