import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { buildItemPath } from '../constants/routes.js'
import styles from './EquippedItems.module.css'

// One equipped item, draggable (id "equipped-<cellId>-<index>") onto another
// unit, or off the board to drop it.
function EquippedItem({ item, index, cellId, onRemove }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `equipped-${cellId}-${index}` })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      className={styles.slot}
      style={isDragging ? { opacity: 0 } : undefined}
      title={`${item.name} (drag to another unit, double-click for stats, right-click to remove)`}
      onDoubleClick={() => navigate(buildItemPath(item.apiName || item.id))}
      onContextMenu={(e) => {
        e.preventDefault()
        onRemove?.(index)
      }}
    >
      <img src={item.iconUrl} alt={item.name} draggable={false} />
    </button>
  )
}

// A board unit's items. Without `cellId` (the drag preview) they're static.
export default function EquippedItems({ itemIds = [], items = [], cellId, onRemove }) {
  if (!itemIds.length) return null

  return (
    <div className={styles.row}>
      {itemIds.map((id, index) => {
        const item = items.find(i => i.id === id)
        if (!item) return null
        return cellId
          ? <EquippedItem key={`${index}-${id}`} item={item} index={index} cellId={cellId} onRemove={onRemove} />
          : (
            <span key={`${index}-${id}`} className={styles.slot}>
              <img src={item.iconUrl} alt={item.name} draggable={false} />
            </span>
          )
      })}
    </div>
  )
}
