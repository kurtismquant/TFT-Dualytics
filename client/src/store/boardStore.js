import { create } from 'zustand'

function getEmblemTrait(item) {
  if (!item || !/emblem/i.test(item.name)) return null
  return item.name.replace(/\s*emblem$/i, '').trim()
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

    for (const trait of champion.traits || []) {
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

export const useBoardStore = create((set, get) => ({
  board: {},
  roster: [],
  items: [],
  activeTraits: {},
  isDragging: false,
  setIsDragging: (v) => set({ isDragging: v }),

  setRoster: (roster) => set({ roster }),
  setItems: (items) => set({ items }),

  placeUnit: (cellId, championId) =>
    set((state) => {
      const board = { ...state.board, [cellId]: { championId, items: [], tier: 1, stars: false } }
      return { board, activeTraits: computeTraits(board, state.roster, state.items) }
    }),

  removeUnit: (cellId) =>
    set((state) => {
      const board = { ...state.board, [cellId]: null }
      return { board, activeTraits: computeTraits(board, state.roster, state.items) }
    }),

  moveUnit: (fromCellId, toCellId) =>
    set((state) => {
      const unit = state.board[fromCellId]
      if (!unit) return {}

      const board = { ...state.board, [fromCellId]: null, [toCellId]: unit }
      return { board, activeTraits: computeTraits(board, state.roster, state.items) }
    }),

  toggleStars: (cellId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      return { board: { ...state.board, [cellId]: { ...cell, stars: !cell.stars } } }
    }),

  addItem: (cellId, itemId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell || !cell.championId) return {}
      if (cell.items.length >= 3) return {}

      // Block emblems on units that already have that trait natively
      const item = state.items.find(i => i.id === itemId)
      if (item) {
        const emblemTrait = getEmblemTrait(item)
        if (emblemTrait) {
          const champion = state.roster.find(c => c.id === cell.championId)
          if ((champion?.traits || []).includes(emblemTrait)) return {}
        }
      }

      const board = { ...state.board, [cellId]: { ...cell, items: [...cell.items, itemId] } }
      return { board, activeTraits: computeTraits(board, state.roster, state.items) }
    }),

  removeItem: (cellId, itemId) =>
    set((state) => {
      const cell = state.board[cellId]
      if (!cell) return {}
      const board = { ...state.board, [cellId]: { ...cell, items: cell.items.filter(id => id !== itemId) } }
      return { board, activeTraits: computeTraits(board, state.roster, state.items) }
    }),

  clearBoard: () =>
    set({ board: {}, activeTraits: {} }),

  // Returns the cellId it filled (null when the board is full) so a caller can
  // undo the placement, e.g. the roster's double-click.
  placeInFirstAvailableHex: (championId) => {
    const { board } = get()
    for (let row = 0; row <= 3; row++) {
      for (let col = 0; col <= 6; col++) {
        const cellId = `cell-${row}-${col}`
        const cell = board[cellId]
        if (!cell || !cell.championId) {
          set((state) => {
            const next = { ...state.board, [cellId]: { championId, items: [], tier: 1, stars: false } }
            return { board: next, activeTraits: computeTraits(next, state.roster, state.items) }
          })
          return cellId
        }
      }
    }
    return null
  },
}))
