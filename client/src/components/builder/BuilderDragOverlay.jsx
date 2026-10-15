import { DragOverlay } from '@dnd-kit/core'
import { useBoardStore } from '../../store/boardStore.js'
import { BoardUnitDragPreview } from '../TFTBoard.jsx'
import UnitIcon from '../UnitIcon.jsx'
import ItemIcon from '../ItemIcon.jsx'

const ROSTER_UNIT_SIZE = 52

// What follows the cursor during a Team Builder drag (useBuilderDrag's
// `dragged`): a board unit with its crown and items at the board's hex size, a
// roster unit, or an item.
export default function BuilderDragOverlay({ dragged, items, hexSize }) {
  const board = useBoardStore(s => s.board)
  let content = null
  if (dragged?.type === 'unit' && dragged.source === 'board') {
    content = (
      <BoardUnitDragPreview
        champion={dragged.champion}
        unit={board[dragged.cellId] || {}}
        items={items}
        size={hexSize}
      />
    )
  } else if (dragged?.type === 'unit') {
    content = <UnitIcon champion={dragged.champion} size={ROSTER_UNIT_SIZE} />
  } else if (dragged?.type === 'item') {
    content = <ItemIcon item={dragged.item} size={42} />
  }
  return (
    <DragOverlay adjustScale={false} dropAnimation={null}>
      {content}
    </DragOverlay>
  )
}
