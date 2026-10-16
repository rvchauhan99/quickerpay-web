'use client'

import React from 'react'
import { Building2, ChevronRight, Loader2 } from 'lucide-react'
import type { PaymentMethod } from '@quickerpay/shared-types'

interface PaymentMethodCardProps {
  method: PaymentMethod
  label: string
  isSelected?: boolean
  isLoading?: boolean
  disabled?: boolean
  onClick: () => void
}

/** Crisp inline SVG for UPI */
function UpiIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="url(#upi-grad)" />
      {/* Dynamic UPI lightning / arrow motif */}
      <path
        d="M23 10L13.5 22.5H20L17 30L26.5 17.5H20L23 10Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="upi-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Crisp inline SVG for Tether USDT */
function UsdtIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="url(#usdt-grad)" />
      {/* Tether USDT symbol */}
      <path
        d="M20 10C14.48 10 10 11.57 10 13.5C10 15.43 14.48 17 20 17C25.52 17 30 15.43 30 13.5C30 11.57 25.52 10 20 10Z"
        fill="#FFFFFF"
        fillOpacity="0.35"
      />
      <path
        d="M21.5 14.8V19.9C26.16 19.67 29.83 18.7 29.83 17.53C29.83 16.36 26.16 15.39 21.5 15.16V14.8ZM18.5 14.8V15.16C13.84 15.39 10.17 16.36 10.17 17.53C10.17 18.7 13.84 19.67 18.5 19.9V14.8H12V12H28V14.8H21.5ZM21.5 20.92V29H18.5V20.92C13.4 20.69 9.5 19.5 9.5 18.06V20.5C9.5 22.16 14.2 23.5 20 23.5C25.8 23.5 30.5 22.16 30.5 20.5V18.06C30.5 19.5 26.6 20.69 21.5 20.92Z"
        fill="#FFFFFF"
      />
      <defs>
        <linearGradient id="usdt-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Micro app logo / chip */
function AppChip({ label, bg = 'bg-slate-100', text = 'text-slate-600' }: { label: string; bg?: string | undefined; text?: string | undefined }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight ${bg} ${text}`}>
      {label}
    </span>
  )
}

interface MethodMeta {
  title: string
  subtitle: string
  badgeText: string
  badgeColor: string
  chips: { label: string; bg?: string; text?: string }[]
  renderIcon: () => React.ReactNode
}

function getMethodMeta(method: PaymentMethod, rawLabel: string): MethodMeta {
  switch (method) {
    case 'UPI':
      return {
        title: 'UPI',
        subtitle: 'Instant payment via any UPI app',
        badgeText: 'INSTANT',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        chips: [
          { label: 'GPay', bg: 'bg-blue-50 text-blue-700' },
          { label: 'PhonePe', bg: 'bg-purple-50 text-purple-700' },
          { label: 'Paytm', bg: 'bg-sky-50 text-sky-700' },
          { label: 'BHIM', bg: 'bg-amber-50 text-amber-800' },
        ],
        renderIcon: () => <UpiIcon className="w-11 h-11 shrink-0 drop-shadow-sm" />,
      }

    case 'MANUAL_BANK':
      return {
        title: 'Direct Bank Transfer',
        subtitle: 'IMPS, NEFT & RTGS to merchant account',
        badgeText: 'ALL BANKS',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/70',
        chips: [
          { label: 'IMPS', bg: 'bg-slate-100 text-slate-700' },
          { label: 'NEFT', bg: 'bg-slate-100 text-slate-700' },
          { label: 'RTGS', bg: 'bg-slate-100 text-slate-700' },
        ],
        renderIcon: () => (
          <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shrink-0 shadow-sm">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
        ),
      }

    case 'USDT_TRC20':
      return {
        title: 'USDT (TRC20)',
        subtitle: 'Crypto deposit via TRON network',
        badgeText: 'TRC-20',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200/70',
        chips: [
          { label: 'TRON (TRC20)', bg: 'bg-emerald-50 text-emerald-700' },
          { label: 'USDT', bg: 'bg-teal-50 text-teal-700' },
        ],
        renderIcon: () => <UsdtIcon className="w-11 h-11 shrink-0 drop-shadow-sm" />,
      }

    default:
      return {
        title: rawLabel || method,
        subtitle: 'Secure payment method',
        badgeText: 'SECURE',
        badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
        chips: [],
        renderIcon: () => (
          <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shrink-0 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
        ),
      }
  }
}

export function PaymentMethodCard({
  method,
  label,
  isLoading = false,
  disabled = false,
  onClick,
}: PaymentMethodCardProps) {
  const meta = getMethodMeta(method, label)

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`
        w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200
        flex items-center justify-between gap-3 group relative
        bg-white hover:bg-slate-50/70
        border-slate-200 hover:border-blue-500
        hover:shadow-md hover:shadow-blue-500/5
        focus:outline-none focus:ring-2 focus:ring-blue-500/20
        active:scale-[0.99]
        ${disabled && !isLoading ? 'opacity-50 cursor-not-allowed hover:border-slate-200 hover:bg-white hover:shadow-none' : ''}
        ${isLoading ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 cursor-wait' : ''}
      `}
    >
      {/* Left icon & content */}
      <div className="flex items-center gap-3.5 min-w-0">
        {meta.renderIcon()}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors">
              {meta.title}
            </span>
            <span
              className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
            >
              {meta.badgeText}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{meta.subtitle}</p>

          {/* Micro chips */}
          {meta.chips.length > 0 ? (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {meta.chips.map((chip) => (
                <AppChip key={chip.label} label={chip.label} bg={chip.bg} text={chip.text} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right chevron or loader */}
      <div className="shrink-0 pl-1">
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
            ${isLoading ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}
          `}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          )}
        </div>
      </div>
    </button>
  )
}
