import { useDraggable } from '@dnd-kit/core'
import ItemIcon from './ItemIcon.jsx'

export default function DraggableItem({ id, item, size = 42, onClick, selected = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })

  const handleKeyDown = (event) => {
    listeners?.onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick(event)
  }

  const wrapperStyle = {
    opacity: isDragging ? 0 : 1,
    cursor: 'grab',
    touchAction: 'none',
    // Tap-to-select highlight (mobile flow). Drag still works on all devices.
    ...(selected ? { outline: '2px solid var(--search-focus-border)', outlineOffset: '1px' } : null),
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={wrapperStyle}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : listeners?.onKeyDown}
      role={onClick ? 'button' : attributes.role}
      tabIndex={onClick ? 0 : attributes.tabIndex}
      aria-pressed={onClick ? selected : undefined}
    >
      <ItemIcon item={item} size={size} />
    </div>
  )
}
