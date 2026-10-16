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

interface MethodMeta {
  title: string
  badgeText: string
  badgeColor: string
  renderIcon: () => React.ReactNode
}

function getMethodMeta(method: PaymentMethod, rawLabel: string): MethodMeta {
  switch (method) {
    case 'UPI':
      return {
        title: 'UPI',
        badgeText: 'INSTANT',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        renderIcon: () => <UpiIcon className="h-8 w-8 shrink-0" />,
      }

    case 'MANUAL_BANK':
      return {
        title: 'Direct Bank Transfer',
        badgeText: 'ALL BANKS',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/70',
        renderIcon: () => (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <Building2 className="h-4 w-4 stroke-[2.2]" />
          </div>
        ),
      }

    case 'USDT_TRC20':
      return {
        title: 'USDT (TRC20)',
        badgeText: 'TRC-20',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200/70',
        renderIcon: () => <UsdtIcon className="h-8 w-8 shrink-0" />,
      }

    default:
      return {
        title: rawLabel || method,
        badgeText: 'SECURE',
        badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
        renderIcon: () => (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-white">
            <Building2 className="h-4 w-4" />
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
        group relative flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all
        bg-white hover:bg-slate-50/70
        border-slate-200 hover:border-blue-500
        focus:outline-none focus:ring-2 focus:ring-blue-500/20
        active:scale-[0.99]
        ${disabled && !isLoading ? 'cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-white' : ''}
        ${isLoading ? 'cursor-wait border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20' : ''}
      `}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {meta.renderIcon()}
        <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600">
          {meta.title}
        </span>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeColor}`}>
          {meta.badgeText}
        </span>
      </div>

      <div className="shrink-0">
        <div
          className={`
            flex h-7 w-7 items-center justify-center rounded-full transition-all
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
