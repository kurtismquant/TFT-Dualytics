import styles from './PageShell.module.css'

export function PageShell({ children, grid = false, wide = false, className }) {
  return (
    <div
      data-page-shell
      className={[
        styles.shell,
        grid ? styles.grid : '',
        wide ? styles.wide : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
