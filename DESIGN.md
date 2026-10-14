# TFT Dualytics — Design System

The source of truth for how the site looks. Tokens live in
[client/src/styles/theme.css](client/src/styles/theme.css), base styles in
[client/src/styles/globals.css](client/src/styles/globals.css), breakpoints in
[client/src/styles/breakpoints.css](client/src/styles/breakpoints.css). If this
file and the code disagree, the code wins: fix this file.

## 1. Character

A dark, technical stats tool with a stencil/HUD voice: near-black canvas,
hairline borders, square corners, uppercase labels with wide tracking. Colour
is earned. Gold is the one brand accent; every other colour is **data**
(champion cost, placement, rank tier, stat quality). Champion and item art
carries the page, so chrome stays quiet around it.

Dark is the default theme; light (`[data-theme="light"]`) re-maps the same
tokens and must be checked for every change.

## 2. Colour

Always use tokens. Never hard-code a hex in a component.

### Surfaces (dark)
| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#000` | Page background |
| `--bg-card` | `#141417` | Cards, comp rows, panels |
| `--bg-elevated` | `#222227` | Raised chips inside cards |
| `--bg-hover` / `--bg-card-hover` | white 8% | Hover and selected tint |
| `--bg-overlay*`, `--bg-scrim` | black 55–85% | Modals, drawer backdrop |

Layer with surface steps (base → card → elevated), not with brighter borders.

### Borders (dark)
| Token | Value | Use |
|---|---|---|
| `--bg-border-muted` | white 10% | Dividers inside a card |
| `--bg-border` | white 18% | Card and row outlines |
| `--bg-border-bright` | white 40% | Inputs, ghost/tab buttons (≥3:1 on black) |

### Text
`--text-primary` (spectral white `rgb(250,250,255)`), `--text-secondary` (78%),
`--text-muted` (50%). Muted is for labels and metadata only, never for
sentences someone has to read.

### Accent: gold only
`--accent-gold` `#f5c542` marks brand and **current/active state**:
- the "DU" in the wordmark and the landing-page corner brackets
- the active nav link underline
- the selected tab (`aria-pressed="true"` → 2px inset gold underline)
- the keyboard focus ring (`--focus-border` = gold)
- the drag-over hex in the comp builder

Hover stays white/neutral, so hover and "selected" never look alike.
`--accent-cyan`, `--accent-red` and `--accent-green` are for status and data
(errors, deltas), not decoration.

### Data palettes
- **Champion cost**: `--cost-1` … `--cost-5` (+ `-glow`). Unit borders, cost filters.
- **Placement**: `--placement-1` … `--placement-4`. Placement badges.
- **Stat quality**: `--stat-tier-0` (best, green) … `--stat-tier-5` (worst, red).
  Never rely on colour alone; pair it with a label or value.
- **Rank tiers**: `--tier-iron` … `--tier-challenger`.
- **Star level**: `--bronze/silver/gold-star-level`.
- **Charts**: `--chart-*` tokens, read in JS via `getComputedStyle`.

## 3. Typography

All faces are self-hosted woff2 in `client/public/fonts` (SIL OFL; licences
next to the files).

| Token | Face | Use |
|---|---|---|
| `--font-display` | Bebas Neue | Nav links, buttons, page titles |
| `--font-body` | D-DIN 400/700 | Everything else, including stat numerals |
| `--font-mono` | IBM Plex Mono 400/500 | Riot ID search inputs only |
| `--font-accent` | Rajdhani 700 | The DUALYTICS landing wordmark only |

Scale: `--text-2xs` 10px → `--text-4xl` 36px (rem, see §5). Weights:
`--fw-regular` 400 and `--fw-bold` 700 only.

### Casing and tracking
- `body` is uppercase with `--track-base`. Labels, nav, headings, buttons,
  table headers, chips and kickers stay uppercase with
  `--track-wide` … `--track-widest`.
- **Prose is sentence case.** Anything read as a sentence (descriptions,
  ability/item text, errors, empty/loading messages, legal copy, the footer
  disclaimer) sets `text-transform: none` and `letter-spacing: var(--track-tight)`.
- Numbers in tables and stat readouts: `font-variant-numeric: tabular-nums`.

## 4. Components and shape

- **Corners are square** (`border-radius: 0`). Exceptions: circles (avatars,
  slider thumbs), 1–2px on tiny bars, and pill badges.
- **Buttons**: `components/ui/Button.jsx`, variants `ghost`, `tab` and `icon`.
  44px minimum height. Hover brightens the border and adds a soft white glow.
- **Inputs**: black fill, `--bg-border-bright` border; focus = white border +
  `--search-focus-glow`.
- **Cards and rows**: `--bg-card` fill with a `--bg-border` hairline; hover
  tints with `--bg-card-hover`.
- **Shadows**: only soft glows (`*-glow` tokens) and `--shadow-elevated` on
  floating layers (dropdowns, hover cards). No drop shadows on in-flow cards.
- **Motion**: `--t-fast` 150ms / `--t-normal` 220ms / `--t-slow` 350ms.
  Everything honours `prefers-reduced-motion` (global override in globals.css).

## 5. Sizing: rem and Interface Size

Settings → Interface Size scales the root font size via `--ui-scale`
(compact 1, standard 1.15, large 1.3; mirrored in
`client/src/constants/uiScale.js`).
- Write sizes in **rem**. Use px only for 1–2px hairlines, borders, outlines and shadows.
- Pixel sizes computed in JS (board hex math, recharts, hover-card
  positioning) must be multiplied by `useUiScale()`.

## 6. Layout and breakpoints

- Pages sit in `components/layout/PageShell.jsx`: `--page-max-width` 77.5rem,
  `--page-gutter` 2rem (1rem ≤720px, 0.75rem ≤480px). The comp builder uses
  the `wide` 90rem variant.
- Optional 12-column grid (`--grid-cols`, `--grid-gap`).
- Breakpoints are `@custom-media` (max-width), usable in any CSS module:

| Name | Max width | Meaning |
|---|---|---|
| `--bp-xl` | 1280px | Nav collapses to the drawer |
| `--bp-lg` | 1024px | Sidebars and multi-column grids stack |
| `--bp-md` | 720px | Mobile: condense, hide secondary data (`useIsMobile`) |
| `--bp-sm` | 480px | Small phone: tightest spacing |

## 7. Accessibility rules

- Keyboard focus is always visible: the global `:focus-visible` ring is 2px
  gold with a 2px offset. A component may replace it (input glow, highlighted
  list option, inset ring on a clipped row) but never remove it without one.
- Touch targets are ≥44px on coarse pointers (global rule).
- Body text must meet 4.5:1; input and button borders 3:1.
- Run `npm run lint:a11y --prefix client` after UI changes.

## 8. Checklist for a UI change

1. Tokens only, rem sizes, square corners.
2. Prose in sentence case; labels uppercase.
3. Check dark and light themes at compact, standard and large Interface Size.
4. Check the 1280 / 1024 / 720 / 480 breakpoints.
5. Tab through it: focus visible, Escape closes overlays.
