import { createPortal } from 'react-dom'
import DroppableHex from './DroppableHex.jsx'
import DraggableUnit from './DraggableUnit.jsx'
import EquippedItems from './EquippedItems.jsx'
import UnitCard from './UnitCard.jsx'
import StarBadge from './StarBadge.jsx'
import { useHoverCard } from '../hooks/useHoverCard.js'
import styles from './TFTBoard.module.css'

// One Team Builder hex and the unit on it: the draggable unit (with its hover
// card), its name, 3★ crown and draggable items. While the unit is dragged its
// name, crown and items ride on the drag preview instead. `highlight` ('on' |
// 'dim' | null) shows which units a hovered trait comes from.
export default function BoardCell({
  cellId, unit, champion, items, size, style, selected, isDragged, highlight, hoverCard,
  onUnitClick, onEmptyHexClick, onRemoveUnit, onRemoveItem, onHover,
}) {
  // Long-press for the detail sheet on touch (a tap selects the unit).
  const { triggerProps, cardProps } = useHoverCard(champion, { touchTrigger: 'longpress' })
  const className = [
    styles.cellWrap,
    highlight === 'on' ? styles.highlighted : '',
    highlight === 'dim' ? styles.dimmed : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={className}
      style={style}
      onPointerEnter={() => onHover(cellId)}
      onPointerLeave={() => onHover(null, cellId)}
    >
      <DroppableHex cellId={cellId} size={size} selected={selected} onClick={() => onEmptyHexClick?.(cellId)}>
        {champion && (
          <>
            <div className={styles.unitWrap} {...triggerProps}>
              <DraggableUnit
                id={`board-${cellId}`}
                champion={champion}
                variant="hex"
                fillParent
                stars={!!unit.stars}
                onClick={(e) => {
                  // Stop the click from also reaching the hex's onClick
                  // (the empty-hex / move-target handler).
                  e.stopPropagation()
                  onUnitClick?.(cellId)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onRemoveUnit?.(cellId)
                }}
              />
            </div>
            {!isDragged && <div className={styles.unitName}>{champion.name}</div>}
          </>
        )}
      </DroppableHex>

      {champion && !isDragged && (
        <>
          {unit.stars && <StarBadge />}
          <EquippedItems
            itemIds={unit.items}
            items={items}
            cellId={cellId}
            onRemove={(index) => onRemoveItem?.(cellId, index)}
          />
        </>
      )}

      {champion && hoverCard && !isDragged && cardProps.isOpen && createPortal(
        <UnitCard {...cardProps} />,
        document.body,
      )}
    </div>
  )
}
