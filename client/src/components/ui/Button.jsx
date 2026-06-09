import styles from './Button.module.css'

/**
 * Shared button primitive. Three visual variants cover the app's recurring
 * button patterns:
 *  - "ghost"  transparent bg, 1px border, text action (clear, add, refresh)
 *  - "tab"    toggle button for filter / segmented groups (aria-pressed)
 *  - "icon"   44px square, icon-only (close, edit, remove)
 *
 * All variants share the Bebas Neue font stack, letter-spacing, and the
 * gold :focus-visible ring from globals.css. Pass `className` to add
 * per-context sizing or layout overrides without duplicating the base styles.
 *
 * For toggle buttons (variant="tab") pass `pressed` — it sets aria-pressed
 * and activates the pressed visual state automatically.
 */
export default function Button({
  variant = 'ghost',
  type = 'button',
  pressed,
  disabled,
  onClick,
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={[styles.btn, styles[variant], className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed !== undefined ? pressed : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
