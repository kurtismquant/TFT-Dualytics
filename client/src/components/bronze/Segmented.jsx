import Button from '../ui/Button.jsx'
import styles from './BronzeComps.module.css'

// A joined row of toggle buttons (one pressed): board size, tiers, max cost,
// Kha'Zix traits, mode. `labelledBy` names the group for screen readers;
// options are [{ value, label, ariaLabel? }].
export default function Segmented({ labelledBy, options, value, onChange }) {
  return (
    <div className={styles.segmentedBar} role="group" aria-labelledby={labelledBy}>
      {options.map(option => (
        <Button
          key={String(option.value)}
          variant="tab"
          className={styles.segment}
          pressed={option.value === value}
          onClick={() => onChange(option.value)}
          aria-label={option.ariaLabel}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
