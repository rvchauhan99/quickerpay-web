interface BrandMarkProps {
  size?: number
  className?: string
}

/** SafePay247 shield mark — safety check on a shield. */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="var(--qp-primary, #2563eb)" />
      <path
        d="M16 5.5L25 8.5V15.2C25 20.4 21.2 24.9 16 26.5C10.8 24.9 7 20.4 7 15.2V8.5L16 5.5Z"
        fill="#ffffff"
      />
      <path
        d="M12.2 15.6L14.6 18L19.8 12.4"
        stroke="var(--qp-primary, #2563eb)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
