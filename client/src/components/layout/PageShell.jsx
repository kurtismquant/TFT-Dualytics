import styles from './PageShell.module.css'

export function PageShell({ children, grid = false, wide = false }) {
  return (
    <div
      className={[
        styles.shell,
        grid ? styles.grid : '',
        wide ? styles.wide : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
