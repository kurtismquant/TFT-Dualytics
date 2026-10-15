// Team Builder unit placement: where a clicked roster unit goes, and the
// Auto-arrange layout of a whole board. Riot match data has no hex positions,
// so placement follows how boards are usually set up, from each unit's role:
//  - tank / assassin (melee; tank when most of the items it holds this patch
//    are pure defensive items): the front row. Assassins sit next to a tank
//    where they can; tanks are ordered highest cost on the edges.
//  - mid (range 2-3): the second row.
//  - ranged (range 4+): the back two rows. The highest-cost ones take the
//    corners, spread one hex apart, AD and AP carries on opposite sides; once
//    the front two rows hold 6+ units they bunch up on one side instead.
// Front-two-row units stand next to their row's other units.
//
// Row 0 is the front (top of the board as drawn), row 3 the back. Odd rows
// are drawn half a hex to the right (TFTBoard).

export const ROWS = 4
export const COLS = 7
const CENTER = (COLS - 1) / 2
const FRONT_ROWS_FOR_CLUSTER = 6
// A melee unit is a tank when at least this share of its items are pure
// defensive items (server boardExplorer.itemKind).
const TANK_MIN_SHARE = 0.5

export const cellIdOf = (row, col) => `cell-${row}-${col}`
export function parseCellId(cellId) {
  const [, row, col] = cellId.split('-').map(Number)
  return { row, col }
}

export function neighbors(row, col) {
  // The rows above and below touch cols (c-1, c) from an even row, (c, c+1) from an odd one.
  const shift = row % 2 === 0 ? -1 : 0
  return [
    [row, col - 1], [row, col + 1],
    [row - 1, col + shift], [row - 1, col + shift + 1],
    [row + 1, col + shift], [row + 1, col + shift + 1],
  ].filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
}

// champion + its item-role stats (/api/stats/explorer/unit-roles row, or
// undefined) -> { role, attribute }. Melee units without stats count as tanks;
// `attribute` ('ad' | 'ap') is null without stats.
export function unitRole(champion, stats) {
  const range = champion?.stats?.range ?? 1
  const attribute = stats && (stats.ad || stats.ap) ? (stats.ad > stats.ap ? 'ad' : 'ap') : null
  if (range >= 4) return { role: 'ranged', attribute }
  if (range >= 2) return { role: 'mid', attribute }
  const assassin = stats?.itemsPerBoard > 0 && stats.tank < TANK_MIN_SHARE
  return { role: assassin ? 'assassin' : 'tank', attribute }
}

// Highest cost first; among equals, the one holding more items (the carry).
const byPriority = (a, b) => b.cost - a.cost || (b.carry || 0) - (a.carry || 0) || a.key.localeCompare(b.key)

// Highest-cost units on both ends, cheaper ones toward the middle.
function edgesFirst(units) {
  const left = []
  const right = []
  units.forEach((unit, i) => (i % 2 === 0 ? left : right).push(unit))
  return [...left, ...right.reverse()]
}

// units: [{ key, cost, role, attribute, carry }] -> Map key -> cellId for every
// unit (fewer than ROWS * COLS units).
export function arrangeBoard(units) {
  const placed = new Map()
  const taken = new Set()
  const put = (unit, row, col) => {
    placed.set(unit.key, cellIdOf(row, col))
    taken.add(cellIdOf(row, col))
  }
  // Nearest free hex to (row, col), same row first.
  const putNear = (unit, row, col) => {
    let best = null
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (taken.has(cellIdOf(r, c))) continue
        const distance = Math.abs(r - row) * 10 + Math.abs(c - col)
        if (!best || distance < best.distance) best = { r, c, distance }
      }
    }
    if (best) put(unit, best.r, best.c)
  }
  // A contiguous run of units, centred in the row.
  const putRow = (row, run) => {
    const start = Math.floor((COLS - run.length) / 2)
    run.forEach((unit, i) => putNear(unit, row, start + i))
  }

  const of = role => units.filter(unit => unit.role === role).sort(byPriority)
  let tanks = of('tank')
  let assassins = of('assassin')
  const overflow = []
  // A full front row keeps the tanks and two flanking assassins, dropping
  // the extra assassins, then the cheapest tanks, to the second row.
  while (tanks.length + assassins.length > COLS) {
    if (assassins.length > 2 || !tanks.length) {
      overflow.push(assassins.at(-1))
      assassins = assassins.slice(0, -1)
    } else {
      overflow.push(tanks.at(-1))
      tanks = tanks.slice(0, -1)
    }
  }
  // Assassins flank the tank line (the first two touch a tank); any more just
  // extend it.
  const left = assassins.filter((_, i) => i % 2 === 0).reverse()
  const right = assassins.filter((_, i) => i % 2 === 1)
  putRow(0, [...left, ...edgesFirst(tanks), ...right])
  putRow(1, [...of('mid'), ...overflow.sort(byPriority)])

  const ranged = of('ranged')
  const frontCount = units.length - ranged.length
  if (frontCount >= FRONT_ROWS_FOR_CLUSTER) {
    // Bunched on one side, the priciest in the corner.
    ranged.forEach(unit => putNear(unit, 3, 0))
    return placed
  }
  // One hex apart, filling from each side's corner. Two attributes: the top
  // unit's attribute takes the left side, the other the right. One: the top
  // two take both corners.
  const fromLeft = [[3, 0], [3, 2], [3, 4], [3, 6], [2, 0], [2, 2], [2, 4], [2, 6]]
  const fromRight = [[3, 6], [3, 4], [3, 2], [3, 0], [2, 6], [2, 4], [2, 2], [2, 0]]
  const leftAttribute = ranged[0]?.attribute
  const split = ranged.some(unit => unit.attribute !== leftAttribute)
  ranged.forEach((unit, i) => {
    const goLeft = split ? unit.attribute === leftAttribute : i % 2 === 0
    const slot = (goLeft ? fromLeft : fromRight).find(([r, c]) => !taken.has(cellIdOf(r, c)))
    if (slot) put(unit, slot[0], slot[1])
    else putNear(unit, 3, goLeft ? 0 : COLS - 1)
  })
  return placed
}

// Where a newly placed unit should go on a board, leaving the units already on
// it where they are. board: [{ key: cellId, row, col, cost, role, attribute }]
// for the placed units; unit: the new one. Returns a free cellId, or null when
// the board is full.
export function pickCell(board, unit) {
  const at = new Map(board.map(placed => [cellIdOf(placed.row, placed.col), placed]))
  const occupied = (row, col) => at.get(cellIdOf(row, col))
  const front = board.filter(placed => placed.row <= 1)
  const back = board.filter(placed => placed.row >= 2)
  const sideOf = units => (units.reduce((sum, u) => sum + u.col, 0) / units.length <= CENTER ? 0 : COLS - 1)

  const score = (row, col) => {
    const near = neighbors(row, col).map(([r, c]) => occupied(r, c)).filter(Boolean)
    const sameRow = near.filter(u => u.row === row).length
    const centred = -Math.abs(col - CENTER)

    if (unit.role === 'tank' || unit.role === 'assassin') {
      const partner = unit.role === 'tank' ? 'assassin' : 'tank'
      // Next to the other role, most of all one with no partner of its own yet.
      const pairing = near.filter(u => u.role === partner).reduce((sum, u) => {
        const paired = neighbors(u.row, u.col).some(([r, c]) => occupied(r, c)?.role === unit.role)
        return sum + (paired ? 15 : 40)
      }, 0)
      return [0, -100, -200, -300][row] + pairing + sameRow * 10 + centred
    }
    if (unit.role === 'mid') {
      return [-100, 0, -200, -300][row] + sameRow * 10 + centred
    }

    // Ranged: the back two rows.
    const rowScore = [-300, -200, -15, 0][row]
    if (front.length >= FRONT_ROWS_FOR_CLUSTER) {
      const side = back.length ? sideOf(back) : 0
      const backNear = near.filter(u => u.row >= 2).length
      return rowScore + backNear * 20 - 2 * Math.abs(col - side)
    }
    const crowded = near.filter(u => u.row === row && u.row >= 2).length
    const same = back.filter(u => u.attribute === unit.attribute)
    const other = back.filter(u => u.attribute !== unit.attribute)
    const side = same.length ? sideOf(same) : other.length ? COLS - 1 - sideOf(other) : 0
    const ranged = [...board.filter(u => u.role === 'ranged'), unit].sort(byPriority)
    const cornerBonus = row === 3 && (col === 0 || col === COLS - 1) && ranged.indexOf(unit) < 2 ? 15 : 0
    return rowScore - crowded * 40 + cornerBonus - 3 * Math.abs(col - side)
  }

  let best = null
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (occupied(row, col)) continue
      const value = score(row, col)
      if (!best || value > best.value) best = { cellId: cellIdOf(row, col), value }
    }
  }
  return best?.cellId ?? null
}
