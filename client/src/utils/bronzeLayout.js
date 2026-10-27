// Trait Comps layout from the page's width, in rem. Sizes mirror
// BronzeComps.module.css: .page (sidebar column + gap), .row (side padding
// 1.25 + 0.75, two column gaps, the copy button, the list's 1px borders),
// .unit / .units, and the traits column at its narrowest.
const SIDEBAR_REM = 18.5 + 1.75
const UNIT_REM = 3.125
const UNIT_GAP_REM = 0.375
const TRAITS_MIN_REM = 12
const ROW_FIXED_REM = 2 + 2 + 2.75 + 0.125

const unitsWidthRem = cols => cols * UNIT_REM + (cols - 1) * UNIT_GAP_REM

// How a row sets out its units beside the traits: all on one line when the
// biggest board fits, else two even lines; failing both, 'stacked' puts the
// traits under the units (the mobile layout).
export function unitLayout(listRem, maxUnits) {
  const room = listRem - ROW_FIXED_REM - TRAITS_MIN_REM
  if (unitsWidthRem(maxUnits) <= room) return 'one'
  if (unitsWidthRem(Math.ceil(maxUnits / 2)) <= room) return 'two'
  return 'stacked'
}

// The filter sidebar sits left of the results only while the rows beside it
// can still keep their traits alongside the units; otherwise (and always on
// tablets and phones) it moves above them, giving the list the full width.
export function bronzeLayout(pageRem, maxUnits, { tabletDown }) {
  const sidebarSide = !tabletDown && unitLayout(pageRem - SIDEBAR_REM, maxUnits) !== 'stacked'
  const listRem = sidebarSide ? pageRem - SIDEBAR_REM : pageRem
  return { sidebar: sidebarSide ? 'side' : 'top', unitLayout: unitLayout(listRem, maxUnits) }
}
