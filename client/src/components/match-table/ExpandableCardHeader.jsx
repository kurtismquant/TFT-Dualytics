import styles from '../MatchTable.module.css'

// A match card's compact summary plus its expand toggle. The toggle is an empty
// sibling stretched over the summary, not a wrapper, so the unit links inside are
// valid (no <a> inside <button>). Clicks on non-interactive parts of the summary
// fall through to it (see .compactContent in MatchTable.module.css).
export default function ExpandableCardHeader({ id, expanded, onToggle, controls, label, contentClassName, children }) {
  return (
    <div className={styles.compact}>
      <button
        type="button"
        className={styles.cardButton}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-label={label}
        id={id}
      />
      <div className={contentClassName}>{children}</div>
    </div>
  )
}
