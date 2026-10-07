import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import UnitIcon from './UnitIcon.jsx'

export default function DraggableUnit({
  id,
  champion,
  size = 60,
  variant = 'rect',
  stars = false,
  fillParent = false,
  staticDuringDrag = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const handleKeyDown = (event) => {
    listeners?.onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick(event)
  }

  // The second click of a double-click is skipped so a double-click runs the
  // click action once, then onDoubleClick (which can undo it).
  const handleClick = (event) => {
    if (event.detail > 1) return
    onClick(event)
  }

  const wrapperStyle = {
    transform: staticDuringDrag || isDragging ? undefined : CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    cursor: 'grab',
    touchAction: 'none',
    ...(fillParent ? { width: '100%', height: '100%' } : null),
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={wrapperStyle}
      onClick={onClick ? handleClick : undefined}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      role={onClick ? 'button' : attributes.role}
      tabIndex={onClick ? 0 : attributes.tabIndex}
      aria-label={onClick ? champion?.name : attributes['aria-label']}
    >
      <UnitIcon
        champion={champion}
        size={size}
        showName={variant !== 'hex'}
        variant={variant}
        stars={stars}
      />
    </div>
  )
}
