import { useState } from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useBoardStore } from '../store/boardStore.js'

// Draggable ids: "roster-<championId>", "board-<cellId>" (a placed unit),
// "item-<itemId>" (the item picker), "equipped-<cellId>-<index>" (an item on a
// unit). Drop targets are the board cells, "cell-<row>-<col>".
const EQUIPPED_RE = /^equipped-(cell-\d-\d)-(\d+)$/

// Team Builder drag and drop:
//  - roster unit -> empty hex: placed (an occupied hex refuses it)
//  - board unit -> hex: moved, or swapped with the unit there; off the board: removed
//  - item -> unit: added; equipped item -> another unit: moved; off the board: removed
// `dragged` is what the drag overlay shows. `onUnitMoved(from, to, swapped)`
// lets the inspector follow its unit.
export function useBuilderDrag({ champions, items, onUnitMoved }) {
  const [dragged, setDragged] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const findChampion = id => champions?.find(c => c.id === id) || null
  const findItem = id => items?.find(i => i.id === id) || null

  const onDragStart = ({ active }) => {
    const { board, setIsDragging } = useBoardStore.getState()
    setIsDragging(true)
    const id = String(active.id)
    const equipped = EQUIPPED_RE.exec(id)
    if (id.startsWith('roster-')) {
      const champion = findChampion(id.replace('roster-', ''))
      setDragged(champion ? { type: 'unit', source: 'roster', champion } : null)
    } else if (id.startsWith('board-')) {
      const cellId = id.replace('board-', '')
      const champion = findChampion(board[cellId]?.championId)
      setDragged(champion ? { type: 'unit', source: 'board', champion, cellId } : null)
    } else if (id.startsWith('item-')) {
      const item = findItem(id.replace('item-', ''))
      setDragged(item ? { type: 'item', item } : null)
    } else if (equipped) {
      const item = findItem(board[equipped[1]]?.items?.[Number(equipped[2])])
      setDragged(item ? { type: 'item', item } : null)
    }
  }

  const onDragEnd = ({ active, over }) => {
    const store = useBoardStore.getState()
    store.setIsDragging(false)
    setDragged(null)
    const id = String(active.id)
    const target = over && String(over.id).startsWith('cell-') ? String(over.id) : null
    const equipped = EQUIPPED_RE.exec(id)

    if (equipped) {
      const [, fromCellId, index] = equipped
      if (target) store.moveItem(fromCellId, Number(index), target)
      else if (!over) store.removeItem(fromCellId, Number(index))
      return
    }
    if (id.startsWith('item-')) {
      if (target) store.addItem(target, id.replace('item-', ''))
      return
    }
    if (!over) {
      if (id.startsWith('board-')) store.removeUnit(id.replace('board-', ''))
      return
    }
    if (!target) return
    const occupied = Boolean(store.board[target]?.championId)
    if (id.startsWith('roster-')) {
      if (!occupied) store.placeUnit(target, id.replace('roster-', ''))
    } else if (id.startsWith('board-')) {
      const fromCellId = id.replace('board-', '')
      if (fromCellId === target) return
      store.moveUnit(fromCellId, target)
      onUnitMoved?.(fromCellId, target, occupied)
    }
  }

  const onDragCancel = () => {
    useBoardStore.getState().setIsDragging(false)
    setDragged(null)
  }

  return { sensors, dragged, onDragStart, onDragEnd, onDragCancel }
}
