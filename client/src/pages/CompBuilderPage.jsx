import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useBoardStore } from '../store/boardStore.js'
import TFTBoard from '../components/TFTBoard.jsx'
import UnitRoster from '../components/UnitRoster.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import TraitList from '../components/TraitList.jsx'
import FilterBar from '../components/FilterBar.jsx'
import UnitIcon from '../components/UnitIcon.jsx'
import ItemIcon from '../components/ItemIcon.jsx'
import { PageShell } from '../components/layout/PageShell.jsx'
import { useIsMobile } from '../hooks/useMediaQuery.js'
import styles from './CompBuilderPage.module.css'

const BOARD_UNIT_SIZE = 90
const ROSTER_UNIT_SIZE = 52

export default function CompBuilderPage() {
  const { t } = useTranslation()
  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const {
    board,
    activeTraits,
    setRoster,
    setItems,
    placeUnit,
    moveUnit,
    removeUnit,
    toggleStars,
    addItem,
    removeItem,
    clearBoard,
    setIsDragging,
  } = useBoardStore()

  const [draggedUnit, setDraggedUnit] = useState(null)
  const [draggedItem, setDraggedItem] = useState(null)
  const searchInputRef = useRef(null)
  const isMobile = useIsMobile()
  // Live hex size reported by the board, so the drag overlay matches it.
  const [boardHexSize, setBoardHexSize] = useState(BOARD_UNIT_SIZE)

  // Mobile tap interactions: a single `selected` slot is either a board unit
  // queued to move, or an item queued to attach. Desktop keeps drag + star/remove.
  const [selected, setSelected] = useState(null)

  // Tap on a placed unit.
  const handleUnitClick = (cellId) => {
    if (!isMobile) {
      toggleStars(cellId)
      return
    }
    if (selected?.type === 'item') {
      addItem(cellId, selected.itemId)
      setSelected(null)
      return
    }
    if (selected?.type === 'boardUnit' && selected.cellId === cellId) {
      setSelected(null)
      return
    }
    setSelected({ type: 'boardUnit', cellId })
  }

  // Tap on an empty hex (occupied cells stopPropagation in TFTBoard).
  const handleEmptyHexClick = (cellId) => {
    if (!isMobile) return
    if (board[cellId]?.championId) return
    if (selected?.type === 'boardUnit') {
      moveUnit(selected.cellId, cellId)
      setSelected(null)
    }
  }

  // Tap an item in the picker (mobile only) to queue it for attaching.
  const handleItemSelect = (itemId) => {
    setSelected(prev =>
      prev?.type === 'item' && prev.itemId === itemId ? null : { type: 'item', itemId },
    )
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isFind = (e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')
      if (!isFind) return
      e.preventDefault()
      const input = searchInputRef.current
      if (input) {
        input.focus()
        input.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const [search, setSearch] = useState('')
  const [champSort, setChampSort] = useState('cost')
  const [itemCategory, setItemCategory] = useState('craftable')
  // Mobile roster panel: 'units' (default) or 'items'. Ignored on desktop (both show).
  const [mode, setMode] = useState('units')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    if (champions) setRoster(champions)
  }, [champions, setRoster])

  useEffect(() => {
    if (items) setItems(items)
  }, [items, setItems])

  const handleDragStart = ({ active }) => {
    setIsDragging(true)
    const id = active.id
    if (id.startsWith('roster-')) {
      const championId = id.replace('roster-', '')
      const champion = champions?.find(c => c.id === championId) || null
      setDraggedUnit(champion ? { champion, source: 'roster' } : null)
    } else if (id.startsWith('board-')) {
      const cellId = id.replace('board-', '')
      const unit = board[cellId]
      const champion = unit ? champions?.find(c => c.id === unit.championId) || null : null
      setDraggedUnit(champion ? { champion, source: 'board' } : null)
    } else if (id.startsWith('item-')) {
      const itemId = id.replace('item-', '')
      setDraggedItem(items?.find(i => i.id === itemId) || null)
    }
  }

  const handleDragEnd = ({ active, over }) => {
    setIsDragging(false)
    setDraggedUnit(null)
    setDraggedItem(null)
    const activeId = active.id

    // Items: only valid target is a board cell that already has a unit.
    // Store's addItem silently no-ops when cell is empty or already has 3 items.
    if (activeId.startsWith('item-')) {
      if (!over) return
      const cellId = String(over.id)
      if (!cellId.startsWith('cell-')) return
      addItem(cellId, activeId.replace('item-', ''))
      return
    }

    if (!over) {
      if (activeId.startsWith('board-')) {
        removeUnit(activeId.replace('board-', ''))
      }
      return
    }

    const targetCellId = String(over.id)
    if (!targetCellId.startsWith('cell-')) return

    if (activeId.startsWith('roster-')) {
      placeUnit(targetCellId, activeId.replace('roster-', ''))
    } else if (activeId.startsWith('board-')) {
      const fromCellId = activeId.replace('board-', '')
      if (fromCellId !== targetCellId) moveUnit(fromCellId, targetCellId)
    }
  }

  const handleDragCancel = () => {
    setIsDragging(false)
    setDraggedUnit(null)
    setDraggedItem(null)
  }

  const renderDragOverlay = () => {
    if (draggedUnit?.source === 'board') {
      return (
        <div style={{ width: boardHexSize, height: boardHexSize }}>
          <UnitIcon champion={draggedUnit.champion} variant="hex" />
        </div>
      )
    }

    if (draggedUnit?.source === 'roster') {
      return <UnitIcon champion={draggedUnit.champion} size={ROSTER_UNIT_SIZE} />
    }

    if (draggedItem) {
      return <ItemIcon item={draggedItem} size={42} />
    }

    return null
  }

  return (
    <PageShell wide>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>{t('builder.title')}</h1>
        {/* Desktop position; on mobile this is hidden and re-shown below the traits. */}
        <button className={styles.clearBtn} onClick={clearBoard}>{t('builder.clearBoard')}</button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={styles.layout}>
          <div className={styles.topRow}>
            <TraitList activeTraits={activeTraits} />

            {/* Mobile-only: clear sits below the traits, top-right of the board. */}
            <button className={styles.clearBtnMobile} onClick={clearBoard}>{t('builder.clearBoard')}</button>

            <div className={styles.boardWrap}>
              <TFTBoard
                board={board}
                champions={champions || []}
                items={items || []}
                isMobile={isMobile}
                selectedCellId={selected?.type === 'boardUnit' ? selected.cellId : null}
                onUnitClick={handleUnitClick}
                onEmptyHexClick={handleEmptyHexClick}
                onRemoveUnit={removeUnit}
                onRemoveItem={removeItem}
                onHexSizeChange={setBoardHexSize}
              />
            </div>
          </div>

          <section className={styles.bottomPanel}>
            <FilterBar
              ref={searchInputRef}
              search={search}
              onSearchChange={setSearch}
              champSort={champSort}
              onChampSortChange={setChampSort}
              itemCategory={itemCategory}
              onItemCategoryChange={setItemCategory}
              mode={mode}
              onModeChange={setMode}
            />

            {/* data-mode drives which panel shows on mobile; both show on desktop. */}
            <div className={styles.bottomGrid} data-mode={mode}>
              <div className={styles.unitsPanel}>
                {champions ? (
                  <UnitRoster
                    champions={champions}
                    search={search}
                    sortMode={champSort}
                    layout="horizontal"
                  />
                ) : (
                  <div className={styles.loading} role="status" aria-live="polite">{t('builder.loadingChampions')}</div>
                )}
              </div>

              <div className={styles.itemsPanel}>
                {items ? (
                  <ItemPicker
                    items={items}
                    search={search}
                    category={itemCategory}
                    onSelect={isMobile ? handleItemSelect : undefined}
                    selectedItemId={selected?.type === 'item' ? selected.itemId : null}
                  />
                ) : (
                  <div className={styles.loading} role="status" aria-live="polite">{t('builder.loadingItems')}</div>
                )}
              </div>
            </div>
          </section>
        </div>

        <DragOverlay adjustScale={false} dropAnimation={null}>
          {renderDragOverlay()}
        </DragOverlay>
      </DndContext>
    </PageShell>
  )
}
