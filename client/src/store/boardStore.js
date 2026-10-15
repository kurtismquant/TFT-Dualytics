import { create } from 'zustand'
import { getEmblemTrait } from '../utils/bronzeComps.js'
import { sanitizeBoard } from '../utils/boardState.js'

const MAX_ITEMS = 3
// Undo steps kept.
const HISTORY_LIMIT = 100
// The board is kept in the browser so a reload doesn't lose it.
const STORAGE_KEY = 'tft.builder.board.v1'

function loadSavedBoard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeBoard(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function saveBoard(board) {
  try {
    const cells = Object.fromEntries(Object.entries(board).filter(([, cell]) => cell?.championId))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cells))
  } catch {
    // Storage full or blocked (private window): the board just isn't kept.
  }
}

function computeTraits(board, roster, allItems) {
  const traitCounts = {}
  const seenChampions = new Set()

  for (const cell of Object.values(board)) {
    if (!cell || !cell.championId) continue

    // Only count the first instance of any specific champion
    if (seenChampions.has(cell.championId)) continue
    seenChampions.add(cell.championId)

    const champion = roster.find(c => c.id === cell.championId)
    if (!champion) continue

    // traitWeights: units that count more than once for a trait (Lux's form
    // trait, see utils/builderRoster.js). Everything else counts once.
    for (const trait of champion.traits || []) {
      traitCounts[trait] = (traitCounts[trait] || 0) + (champion.traitWeights?.[trait] ?? 1)
    }

    // Traits picked in the unit inspector (Kha'Zix's evolutions), +1 each.
    for (const trait of cell.chosenTraits || []) {
      traitCounts[trait] = (traitCounts[trait] || 0) + 1
    }

    // Emblem items grant +1 to the corresponding trait
    for (const itemId of (cell.items || [])) {
      const item = allItems?.find(i => i.id === itemId)
      const emblemTrait = getEmblemTrait(item)
      if (emblemTrait) {
        traitCounts[emblemTrait] = (traitCounts[emblemTrait] || 0) + 1
      }
    }
  }

  return traitCounts
}

// An emblem for a trait the unit already has does nothing, so it can't be added.
function itemFits(state, cell, itemId) {
  const emblemTrait = getEmblemTrait(state.items.find(i => i.id === itemId))
  if (!emblemTrait) return true
  const champion = state.roster.find(c => c.id === cell.championId)
  return !(champion?.traits || []).includes(emblemTrait)
}

// Inside batch(), board changes skip the undo history; batch() records one step.
let batchDepth = 0

// Every board change goes through here: new trait counts and, outside a batch,
// the previous board on the undo stack (and the redo stack cleared).
function commit(state, board) {
  const history = batchDepth ? {} : { past: [...state.past, state.board].slice(-HISTORY_LIMIT), future: [] }
  return { board, activeTraits: computeTraits(board, state.roster, state.items), ...history }
}

export const useBoardStore = create((set, get) => ({
  board: loadSavedBoard(),
  roster: [],
  items: [],
  activeTraits: {},
  isDragging: false,
  // Undo / redo stacks of earlier / undone boards.
  past: [],
  future: [],
  setIsDragging: (v) => set({ isDragging: v }),

  // The roster arriving also drops saved units it no longer has (a new set).
  setRoster: (roster) =>
    set((state) => {
      const known = new Set(roster.map(c => c.id))
      const board = roster.length
        ? Object.fromEntries(Object.entries(state.board).filter(([, cell]) => !cell || known.has(cell.championId)))
        : state.board
      return { roster, board, activeTraits: computeTraits(board, roster, state.items) }
    }),
  setItems: (items) =>
    set((state) => ({ items, activeTraits: computeTraits(state.board, state.roster, items) })),

  // Runs several board changes as one undo step (paste team code, Auto-arrange).
  batch: (fn) => {
    const before = get().board
    batchDepth++
    let result
    try {
      result = fn()
    } finally {
      batchDepth--
    }
    if (get().board !== before) {
      set((state) => ({ past: [...state.past, before].slice(-HISTORY_LIMIT), future: [] }))
    }
    return result
  },

  undo: () =>
    set((state) => {
      if (!state.past.length) return {}
      const board = state.past.at(-1)
      return {
        board,
        past: state.past.slice(0, -1),
        future: [...state.future, state.board],
        activeTraits: computeTraits(board, state.roster, state.items),
      }
    }),

  redo: () =>
    set((state) => {
      if (!state.future.length) return {}
      const board = state.future.at(-1)
      return {
        board,
        future: state.future.slice(0, -1),
        past: [...state.past, state.board],
        activeTraits: computeTraits(board, state.roster, state.items),
      }
    }),

  // Replace the whole board (a shared link).
  loadBoard: (board) => set((state) => commit(state, board)),

  placeUnit: (cellId, championId) =>
    set((state) => commit(state, { ...state.board, [cellId]: { championId, items: [], tier: 1, stars: false } })),

  removeUnit: (cellId) =>
    set((state) => (state.board[cellId] ? commit(state, { ...state.board, [cellId]: null }) : {})),

  // Onto an occupied hex the two units swap places.
  moveUnit: (fromCellId, toCellId) =>
    set((state) => {
      const unit = state.board[fromCellId]
      if (!unit) return {}
      return commit(state, { ...state.board, [fromCellId]: state.board[toCellId] ?? null, [toCellId]: unit })
    }),

  toggleStars: (cellId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      return commit(state, { ...state.board, [cellId]: { ...cell, stars: !cell.stars } })
    }),

  // Swap the unit in a cell, keeping its items and 3★: the inspector's Lux form
  // picker (base Lux -> "Blossom Lux").
  setCellChampion: (cellId, championId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      return commit(state, { ...state.board, [cellId]: { ...cell, championId } })
    }),

  // Traits chosen in game for this unit (Kha'Zix's evolutions).
  setChosenTraits: (cellId, chosenTraits) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      return commit(state, { ...state.board, [cellId]: { ...cell, chosenTraits } })
    }),

  addItem: (cellId, itemId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell || !cell.championId) return {}
      if (cell.items.length >= MAX_ITEMS || !itemFits(state, cell, itemId)) return {}
      return commit(state, { ...state.board, [cellId]: { ...cell, items: [...cell.items, itemId] } })
    }),

  // Replace a unit's items with a full build (the inspector's item combos), up
  // to 3. Emblems for a trait the unit already has are dropped, as in addItem.
  setCellItems: (cellId, itemIds) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell || !cell.championId) return {}
      const items = itemIds.filter(itemId => itemFits(state, cell, itemId)).slice(0, MAX_ITEMS)
      return commit(state, { ...state.board, [cellId]: { ...cell, items } })
    }),

  // By slot index: a unit can hold two copies of an item, and only one goes.
  removeItem: (cellId, index) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      return commit(state, { ...state.board, [cellId]: { ...cell, items: cell.items.filter((_, i) => i !== index) } })
    }),

  // Drag an equipped item onto another unit. A target with 3 items (or one the
  // item can't go on) leaves both units as they were.
  moveItem: (fromCellId, index, toCellId) =>
    set((state) => {
      const from = state.board[fromCellId]
      const to = state.board[toCellId]
      const itemId = from?.items?.[index]
      if (!itemId || !to?.championId || fromCellId === toCellId) return {}
      if (to.items.length >= MAX_ITEMS || !itemFits(state, to, itemId)) return {}
      return commit(state, {
        ...state.board,
        [fromCellId]: { ...from, items: from.items.filter((_, i) => i !== index) },
        [toCellId]: { ...to, items: [...to.items, itemId] },
      })
    }),

  // Move every unit at once (Auto-arrange): `moves` maps each occupied cellId
  // to its new cellId.
  moveUnits: (moves) =>
    set((state) => {
      const board = {}
      for (const [from, to] of moves) board[to] = state.board[from]
      return commit(state, board)
    }),

  clearBoard: () =>
    set((state) => (Object.values(state.board).some(cell => cell?.championId) ? commit(state, {}) : {})),

  // Returns the cellId it filled (null when the board is full).
  placeInFirstAvailableHex: (championId) => {
    const { board } = get()
    for (let row = 0; row <= 3; row++) {
      for (let col = 0; col <= 6; col++) {
        const cellId = `cell-${row}-${col}`
        const cell = board[cellId]
        if (!cell || !cell.championId) {
          get().placeUnit(cellId, championId)
          return cellId
        }
      }
    }
    return null
  },
}))

useBoardStore.subscribe((state, prev) => {
  if (state.board !== prev.board) saveBoard(state.board)
})
