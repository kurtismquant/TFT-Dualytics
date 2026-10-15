// Team Builder boards outside the app: the copy saved in the browser and the
// shareable link (/builder?b=...). A board is { 'cell-<row>-<col>': cell },
// cell = { championId, items: [itemId], tier, stars, chosenTraits? }.

const CELL_RE = /^cell-[0-3]-[0-6]$/
const ID_RE = /^[A-Za-z0-9_]{1,64}$/
const TRAIT_RE = /^[A-Za-z0-9]{1,32}$/
const MAX_ITEMS = 3

// Anything parsed from storage or a link -> a valid board (bad cells dropped).
export function sanitizeBoard(raw) {
  const board = {}
  if (!raw || typeof raw !== 'object') return board
  for (const [cellId, cell] of Object.entries(raw)) {
    if (!CELL_RE.test(cellId) || !cell || !ID_RE.test(cell.championId ?? '')) continue
    const items = Array.isArray(cell.items) ? cell.items.filter(id => ID_RE.test(id ?? '')).slice(0, MAX_ITEMS) : []
    const next = { championId: cell.championId, items, tier: 1, stars: cell.stars === true }
    const chosen = Array.isArray(cell.chosenTraits) ? cell.chosenTraits.filter(t => TRAIT_RE.test(t ?? '')) : []
    if (chosen.length) next.chosenTraits = [...new Set(chosen)]
    board[cellId] = next
  }
  return board
}

// ── Shareable link ──────────────────────────────────────────────────────────
// Version, then one entry per unit, separated by '*' (left alone by URL
// encoding, like '.', '-' and '_'):
//   <row><col>.<unit>.<item>-<item>.<s if 3★>.<trait>-<trait>
// e.g. "1*03.18_Ahri.InfinityEdge-GiantSlayer.s". Ids drop their "DA_" prefix
// to keep links short; an id without one is written with a leading "!".
const VERSION = '1'
const PREFIX = 'DA_'

const shortId = id => (id.startsWith(PREFIX) ? id.slice(PREFIX.length) : `!${id}`)
const longId = token => (token.startsWith('!') ? token.slice(1) : `${PREFIX}${token}`)

export function encodeBoardLink(board) {
  const units = Object.entries(board || {})
    .filter(([cellId, cell]) => CELL_RE.test(cellId) && cell?.championId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cellId, cell]) => {
      const [, row, col] = cellId.split('-')
      const fields = [
        `${row}${col}`,
        shortId(cell.championId),
        (cell.items || []).map(shortId).join('-'),
        cell.stars ? 's' : '',
        (cell.chosenTraits || []).join('-'),
      ]
      while (fields.at(-1) === '') fields.pop()
      return fields.join('.')
    })
  return units.length ? [VERSION, ...units].join('*') : null
}

// Link value -> board, or null when it isn't one.
export function decodeBoardLink(value) {
  const [version, ...entries] = String(value ?? '').split('*')
  if (version !== VERSION || !entries.length) return null
  const raw = {}
  for (const entry of entries) {
    const [pos = '', unit = '', items = '', flags = '', traits = ''] = entry.split('.')
    if (!/^[0-3][0-6]$/.test(pos) || !unit) return null
    raw[`cell-${pos[0]}-${pos[1]}`] = {
      championId: longId(unit),
      items: items ? items.split('-').map(longId) : [],
      stars: flags.includes('s'),
      chosenTraits: traits ? traits.split('-') : [],
    }
  }
  const board = sanitizeBoard(raw)
  return Object.keys(board).length ? board : null
}
