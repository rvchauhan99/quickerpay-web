'use client'

import React, { useState, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-md animate-in fade-in zoom-in-95 duration-150
            ${position === 'top' ? 'bottom-full mb-1.5' : ''}
            ${position === 'bottom' ? 'top-full mt-1.5' : ''}
            ${position === 'left' ? 'right-full mr-1.5' : ''}
            ${position === 'right' ? 'left-full ml-1.5' : ''}
          `}
        >
          {content}
          <div
            className={`absolute h-1.5 w-1.5 rotate-45 bg-zinc-900
              ${position === 'top' ? 'bottom-[-3px] left-1/2 -translate-x-1/2' : ''}
              ${position === 'bottom' ? 'top-[-3px] left-1/2 -translate-x-1/2' : ''}
              ${position === 'left' ? 'right-[-3px] top-1/2 -translate-y-1/2' : ''}
              ${position === 'right' ? 'left-[-3px] top-1/2 -translate-y-1/2' : ''}
            `}
          />
        </div>
      )}
    </div>
  )
}
