import styles from './ItemIcon.module.css'

export default function ItemIcon({ item, size = 28 }) {
  if (!item || !item.iconUrl) return null
  // rem (not px) so the icon follows the Interface Size setting.
  const dim = `${size / 16}rem`
  return (
    <div
      className={styles.icon}
      style={{ width: dim, height: dim }}
    >
      <img
        src={item.iconUrl}
        alt={item.name}
        className={styles.img}
        loading="lazy"
      />
    </div>
  )
}
