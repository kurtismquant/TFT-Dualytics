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
        <div style={{ width: BOARD_UNIT_SIZE, height: BOARD_UNIT_SIZE }}>
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

            <div className={styles.boardWrap}>
              <TFTBoard
                board={board}
                champions={champions || []}
                items={items || []}
                onToggleStars={toggleStars}
                onRemoveUnit={removeUnit}
                onRemoveItem={removeItem}
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
            />

            <div className={styles.bottomGrid}>
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

              {items ? (
                <ItemPicker
                  items={items}
                  search={search}
                  category={itemCategory}
                />
              ) : (
                <div className={styles.loading} role="status" aria-live="polite">{t('builder.loadingItems')}</div>
              )}
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
