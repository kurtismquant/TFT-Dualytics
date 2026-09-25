// Interface Size setting. Keep the factors in sync with --ui-scale in
// styles/theme.css; the CSS side scales everything rem-based, these factors
// scale the few sizes that are computed in JS (board hexes, charts, hover card).
export const UI_SCALES = {
  compact: 1,
  standard: 1.15,
  large: 1.3,
}

export const DEFAULT_UI_SCALE = 'standard'
