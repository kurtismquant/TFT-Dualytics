import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext } from '@dnd-kit/core'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useRecommendedUnits } from '../hooks/useUnitPartners.js'
import { useUnitPlacement } from '../hooks/useUnitPlacement.js'
import { useBuilderDrag } from '../hooks/useBuilderDrag.js'
import { useSharedBoardLink } from '../hooks/useSharedBoardLink.js'
import { useBoardStore } from '../store/boardStore.js'
import TFTBoard from '../components/TFTBoard.jsx'
import UnitRoster from '../components/UnitRoster.jsx'
import UnitInspector from '../components/builder/UnitInspector.jsx'
import BuilderToolbar from '../components/builder/BuilderToolbar.jsx'
import BuilderDragOverlay from '../components/builder/BuilderDragOverlay.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import TraitList from '../components/TraitList.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { PageShell } from '../components/layout/PageShell.jsx'
import { useIsMobile } from '../hooks/useMediaQuery.js'
import { listedRoster, toBuilderRoster, withFormBases } from '../utils/builderRoster.js'
import { TRAIT_CHOICE_UNITS } from '../utils/bronzeComps.js'
import { makeMap } from '../utils/statsFormatting.js'
import { encodeTeamPlannerCode } from '../utils/teamPlannerCode.js'
import styles from './CompBuilderPage.module.css'

const BOARD_UNIT_SIZE = 90

// Page-wide keys and guards: Ctrl/Cmd+F jumps to the roster search, and no
// native browser drags (pressing on a blank spot inside a text selection would
// drag a ghost of every selected icon; units and items use dnd-kit's pointer
// dragging, and text fields keep their own).
function usePageGuards(searchInputRef) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    const blockNativeDrag = (e) => {
      if (!/^(INPUT|TEXTAREA)$/.test(e.target?.nodeName)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('dragstart', blockNativeDrag)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('dragstart', blockNativeDrag)
    }
  }, [searchInputRef])
}

export default function CompBuilderPage() {
  const { t } = useTranslation()
  const { data: allChampions } = useChampions()
  // Builder view of the roster: Lux forms renamed, plus base Lux (pickForm),
  // which desktop lists instead of the forms (picked in the unit inspector).
  const champions = useMemo(
    () => (allChampions ? withFormBases(toBuilderRoster(allChampions), allChampions) : undefined),
    [allChampions],
  )
  const { data: items } = useItems()
  const { board, activeTraits, setRoster, setItems, moveUnit, removeUnit, addItem, removeItem, clearBoard } = useBoardStore()
  useEffect(() => { if (champions) setRoster(champions) }, [champions, setRoster])
  useEffect(() => { if (items) setItems(items) }, [items, setItems])
  useSharedBoardLink(Boolean(champions))

  // In-game Team Planner code for the units on the board (null when empty).
  const rosterById = useMemo(() => makeMap(champions), [champions])
  const allChampionsById = useMemo(() => makeMap(allChampions), [allChampions])
  const teamCode = useMemo(() => encodeTeamPlannerCode(
    Object.values(board).filter(cell => cell?.championId).map(cell => rosterById.get(cell.championId)).filter(Boolean),
    allChampionsById,
  ), [board, rosterById, allChampionsById])
  // Roster units often played with everything on the board get gold names;
  // `partners` (boards, avg placement) feeds the summary line.
  const { recommendedIds, partners } = useRecommendedUnits(board, champions)
  // Clicked roster units go where their role usually stands; Auto-arrange
  // lays the whole board out that way.
  const { placeUnit: placeByRole, autoArrange } = useUnitPlacement(champions)

  const searchInputRef = useRef(null)
  usePageGuards(searchInputRef)
  const isMobile = useIsMobile()
  // Live hex size reported by the board, so the drag overlay matches it.
  const [boardHexSize, setBoardHexSize] = useState(BOARD_UNIT_SIZE)
  // Hovered trait (its units light up) and roster unit (its traits preview).
  const [hoveredTrait, setHoveredTrait] = useState(null)
  const [hoveredRosterId, setHoveredRosterId] = useState(null)

  // Mobile tap interactions: a single `selected` slot is either a board unit
  // queued to move, or an item queued to attach. Desktop clicks a unit to open
  // the unit inspector on it instead.
  const [selected, setSelected] = useState(null)
  // Desktop unit inspector: the board cell it shows. It closes by itself when
  // that cell empties (unit removed, dragged off, board cleared).
  const [inspectedCellId, setInspectedCellId] = useState(null)
  const inspectedCell = isMobile ? null : board[inspectedCellId]
  const inspected = inspectedCell?.championId ? rosterById.get(inspectedCell.championId) : null
  const closeInspector = useCallback(() => setInspectedCellId(null), [])

  // Desktop: placing a unit whose traits are picked in game (base Lux,
  // Kha'Zix) opens the inspector on it, so its trait picker is right there.
  useEffect(() => {
    if (isMobile) return undefined
    const count = board => Object.values(board).filter(cell => cell?.championId).length
    return useBoardStore.subscribe((state, prev) => {
      // Only a placement adds a unit (moves and Auto-arrange don't).
      if (count(state.board) <= count(prev.board)) return
      for (const [cellId, cell] of Object.entries(state.board)) {
        const id = cell?.championId
        if (!id || prev.board[cellId]?.championId === id) continue
        const champion = state.roster.find(c => c.id === id)
        if (champion?.pickForm || TRAIT_CHOICE_UNITS[id]) setInspectedCellId(cellId)
      }
    })
  }, [isMobile])

  const { sensors, dragged, onDragStart, onDragEnd, onDragCancel } = useBuilderDrag({
    champions,
    items,
    // The inspector follows its unit (either side of a swap).
    onUnitMoved: (from, to, swapped) => setInspectedCellId(current => (
      current === from ? to : swapped && current === to ? from : current
    )),
  })

  // A pasted Team Planner code replaces the board, laid out by Auto-arrange,
  // as one undo step. Placing Lux / Kha'Zix opens the inspector on them (the
  // subscription above); the functional update then follows that unit.
  const handleImportCode = (championIds) => {
    setInspectedCellId(null)
    const moves = useBoardStore.getState().batch(() => {
      const { clearBoard: clear, placeInFirstAvailableHex } = useBoardStore.getState()
      clear()
      for (const id of championIds) placeInFirstAvailableHex(id)
      return autoArrange()
    })
    setInspectedCellId(current => moves.get(current) ?? current)
  }

  // The inspector follows its unit to its new hex.
  const handleAutoArrange = () => {
    const moves = autoArrange()
    setInspectedCellId(current => moves.get(current) ?? current)
  }

  // Tap on a placed unit.
  const handleUnitClick = (cellId) => {
    if (!isMobile) {
      setInspectedCellId(current => (current === cellId ? null : cellId))
      return
    }
    if (selected?.type === 'item') {
      addItem(cellId, selected.itemId)
      setSelected(null)
      return
    }
    setSelected(selected?.type === 'boardUnit' && selected.cellId === cellId ? null : { type: 'boardUnit', cellId })
  }

  // Tap on an empty hex (occupied cells stopPropagation in TFTBoard).
  const handleEmptyHexClick = (cellId) => {
    if (!isMobile || board[cellId]?.championId) return
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

  // What the hovered roster unit would add to the traits (nothing if it's on
  // the board already: a unit counts once).
  const traitPreview = useMemo(() => {
    const champion = rosterById.get(hoveredRosterId)
    if (!champion || Object.values(board).some(cell => cell?.championId === champion.id)) return null
    return Object.fromEntries((champion.traits || []).map(trait => [trait, champion.traitWeights?.[trait] ?? 1]))
  }, [hoveredRosterId, rosterById, board])

  const [search, setSearch] = useState('')
  const [champSort, setChampSort] = useState('cost')
  const [itemCategory, setItemCategory] = useState('craftable')
  // Mobile roster panel: 'units' (default) or 'items'. Ignored on desktop (both show).
  const [mode, setMode] = useState('units')

  return (
    <PageShell wide className={inspected ? styles.shellWithInspector : undefined}>
      <BuilderToolbar
        board={board}
        champions={champions}
        teamCode={teamCode}
        partners={partners}
        onImportCode={handleImportCode}
        onAutoArrange={handleAutoArrange}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className={styles.layout}>
          <div className={styles.topRow}>
            <TraitList activeTraits={activeTraits} preview={traitPreview} onHoverTrait={setHoveredTrait} />

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
                draggingCellId={dragged?.source === 'board' ? dragged.cellId : null}
                highlightTrait={hoveredTrait}
                inspectedCellId={inspected ? inspectedCellId : null}
                /* Mobile-only: clear sits inside the board, top-right corner. */
                overlay={isMobile ? (
                  <button className={styles.clearBtnMobile} onClick={clearBoard}>
                    {t('builder.clearBoard')}
                  </button>
                ) : null}
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
                    champions={listedRoster(champions, { collapseForms: !isMobile })}
                    search={search}
                    sortMode={champSort}
                    layout="horizontal"
                    recommendedIds={recommendedIds}
                    onPlace={placeByRole}
                    onHoverUnit={setHoveredRosterId}
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

        <BuilderDragOverlay dragged={dragged} items={items} hexSize={boardHexSize} />
      </DndContext>

      {inspected && (
        <UnitInspector
          cellId={inspectedCellId}
          cell={inspectedCell}
          champion={inspected}
          roster={champions}
          allItems={items}
          onClose={closeInspector}
        />
      )}
    </PageShell>
  )
}
