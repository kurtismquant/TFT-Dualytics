import styles from './StarBadge.module.css'

// Slim five-point star in a 24×24 box.
const STAR_PATH = 'M12 1.4L14.7 8.88L22.65 9.14L16.37 14.02L18.58 21.66L12 17.2L5.42 21.66L7.63 14.02L1.35 9.14L9.3 8.88Z'
const STARS = ['left', 'center', 'right']

// A 3★ unit's marker: three stars along the top edges of its board hex, the
// middle one on the hex's top point. Sized from the hex (`--hex-size`, set by
// the board).
export default function StarBadge() {
  return (
    <div className={styles.badge} aria-hidden="true">
      {STARS.map(position => (
        <svg key={position} className={`${styles.star} ${styles[position]}`} viewBox="0 0 24 24" focusable="false">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  )
}
