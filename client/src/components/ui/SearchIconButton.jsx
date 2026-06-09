import { useState } from 'react'

/**
 * Magnifying-glass submit button used by the compact (nav) and hero search
 * surfaces. The icon dims when idle and brightens on hover/focus. Callers pass
 * the positioning `className` from their own module.
 */
export default function SearchIconButton({
  className,
  disabled,
  label,
  size = 18,
  restOpacity = 0.7,
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        fill="none"
        style={{ opacity: hover ? 1 : restOpacity, transition: 'opacity 150ms' }}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="12" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}
