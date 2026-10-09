import { useNavigate } from 'react-router-dom'
import { buildItemPath } from '../constants/routes.js'
import styles from './EquippedItems.module.css'

export default function EquippedItems({ itemIds = [], items = [], onRemove }) {
  const navigate = useNavigate()
  if (!itemIds.length) return null

  return (
    <div className={styles.row}>
      {itemIds.map(id => {
        const item = items.find(i => i.id === id)
        if (!item) return null
        return (
          <button
            key={id}
            type="button"
            className={styles.slot}
            title={`${item.name} (double-click for stats, right-click to remove)`}
            onDoubleClick={() => navigate(buildItemPath(item.apiName || item.id))}
            onContextMenu={(e) => {
              e.preventDefault()
              onRemove?.(id)
            }}
          >
            <img src={item.iconUrl} alt={item.name} draggable={false} />
          </button>
        )
      })}
    </div>
  )
}
