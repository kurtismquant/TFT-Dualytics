# Architecture (agent-facing)

Dense reference for future sessions. Not human-facing docs.

## Overview
TFT **Double Up** stats web app. Ingests Riot match data → MongoDB, aggregates top comps / unit-item-trait stats / leaderboards, serves via Express; React SPA renders comps, stats, drag-drop comp builder, leaderboard, and 1-or-2 summoner match history. Only `tft_game_type === 'pairs'` (Double Up) + current set (17) is ever stored/shown.

## Tech stack
- **Server**: Node ESM, Express, MongoDB driver, `node-cron`, `axios`, `p-queue`. No build step. Tests via `node --test`.
- **Client**: React 18, Vite, React Router, `@tanstack/react-query` (server cache), Zustand (board/bookmarks), `react-i18next` (en/es), CSS Modules + `styles/theme.css` tokens.
- **Deploy**: Vercel (client `dist`, SPA rewrite in `vercel.json`); server runs separately. Env via `server/loadEnv.js` (dotenv).
- **Data sources**: Riot API (single personal key), Data Dragon (icons), Community Dragon (traits/items/augments metadata).

## Agent boundaries (.claude/agents/*.md)
- **riot-pipeline** — owns `server/index.js`, `server/routes/**`, `server/db/**`, `server/scripts/**`, `server/test/**`, and services `riotApi`, `assetResolver`, `summonerMatches`, `leaderboard*`, `compsAggregator`, `statsAggregator`. NEVER: `client/**`; `RIOT_API_KEY` outside `riotApi.js`; the domain modules below (import, don't re-derive).
- **ui** — owns `client/src/{App,main}.jsx`, `pages/**`, `components/**`, `styles/**`, `contexts/**`, `store/**`, `hooks/**`, `i18n/**`, `api/client.js`, `constants/routes.js`. NEVER: `server/**`/`.env`; the Riot key; inline domain logic in components; hardcoded set/region constants; unilateral API-contract changes.
- **domain-contract** — owns `server/services/{matchNormalizers,unitUtils,patchFilters,teamPlacement}.js`, both `constants/game.js`, `client/src/constants/regions.js`, `client/src/utils/**`, `client/src/data/**`. NEVER: I/O (no axios/mongo/express/React), persistence/query construction, rendering/state. Pure + unit-testable only. Defines route↔hook contract.

## Fixed (vs concern map)
- resolveUnits unified → `client/src/utils/resolveUnits.js`; `comp-row/resolveUnits.js` + `match-table/formatters.js` now re-export it.
- teamPlacement (`Math.ceil(p/2)`) → `server/services/teamPlacement.js`; used by matchNormalizers/comps/stats.
- patch math → `server/services/patchFilters.js`; `compsAggregator` imports it directly (comps→stats dep severed; `statsAggregator` re-exports for back-compat; `getAvailablePatches`/`getCurrentPatchWindow` stay in stats — they hit DB).

## Remaining violations (NOT fixed)
- **Mixed-concern god files** (split candidates): `StatsPage.jsx` (~460L, sub-components+color/sort logic inline), `summonerMatches.js` (~444L, job-state-machine + fetch pipeline + response shaping + validation), `assetResolver.js` (fetch + classify + URL-transform + in-memory store/getters).
- **Cross-package dup, NOT unified** (no monorepo/shared pkg): `CURRENT_SET=17` in both `server/constants/game.js` and `client/src/constants/game.js`; region maps in `server/services/riotApi.js` (`getPlatformRegion`/`getMassRegion`) vs `client/src/constants/regions.js`. Kept as mirrors — **edit together**.
- **Unit/trait shaping dup**: `matchNormalizers.normalizeUnits/normalizeTraits` vs `compsAggregator.extractComp` vs `statsAggregator` inline trait reshape all re-implement filter-tier>0 / halve `num_units` when doubled / map items.
- **formatRound dup**: `match-table/formatters.formatRound` reimplements `utils/roundToStage.lastRoundToStage`.
- **Other**: `summoner.js` route holds serialization/partner-cross-ref (business logic in HTTP layer); `boardStore.js` embeds trait/emblem rules; `LandingPage.jsx` inlines `Starfield` canvas engine; `riotSearch.js` mixes pure parse/validate with apiGet+navigate; `App.jsx` inlines `GearIcon`; 3 near-parallel search bars (`SearchBar`/`NavSearchBar`/`LandingSearchBar`).

## Key decisions (inferred)
- **Mongo is source of truth; DB-first lookups** skip the Riot Account API when puuid known. Match docs **trimmed** (~56% smaller) to only fields consumers read; `buildMatchDocument` MUST stay idempotent (migrations re-run it). Non-pairs games stored as tiny **stubs** so they dedup in `filterKnownMatchIds` without keeping ~40KB payload.
- **Single Riot key isolated in `riotApi.js`**; dual `p-queue` (long: 100/2min, short: 20/s) enforces both windows; priority 10 = user, 0 = background; AbortSignal cancels queued+in-flight; 429 respects `Retry-After`; 403 → key-expired error.
- **Patch system**: Riot `game_version` LoL number (16.x) ↔ user-facing TFT label (17.x) via `LOL_SEASON=16`, `SET_LAUNCH_LOL_MINOR=8` (TFT 17.1 = LoL 16.8). Filters convert TFT→LoL regex for DB queries.
- **Rank snapshots** append-on-change (`rankSnapshotsRepo`) because match payload lacks LP — needed for the LP graph; clipped to set-release to avoid cross-set MMR-reset deltas.
- **Two background paths**: in-process cron (re-aggregate comps /10min, leaderboard match-sync hourly) vs standalone **pausable ingest daemon** (`scripts/ingest.js`, round-robins top-N ladder, resumable cursor in `ingestionStateRepo`) — both share the one key budget, so daemon has a pause sentinel to yield to the webapp.
- **TTL index** on `gameDate` auto-expires old matches (`MATCH_TTL_DAYS`, default 90).
- Background jobs gated by `ENABLE_BACKGROUND_JOBS`; Mongo-down → memory-only degraded mode.

## Danger zones
- `server/services/riotApi.js` — key isolation + rate-limit queues; mistakes here leak the key or get the key banned. Single chokepoint.
- `server/services/summonerMatches.js` — sync-job state machine + ETA + the `matchHistorySyncedThrough` cursor (only advances on full completion so partial newest-first writes don't skip older matches). Subtle; touch carefully.
- `server/db/matchRepo.js` `buildMatchDocument`/`buildMatchStub` — idempotency contract; `trim-matches.js`/`prune-matches.js` migrations depend on it.
- `server/db/mongo.js` `createIndexes` — unique + TTL + multikey indexes; changing shapes can silently break aggregation scans.
- `client/src/utils/estimateMatchLp.js` (~324L) — heuristic LP-estimation model (provisional games, decay, calibration). Has a real test suite (`estimateMatchLp.test.js`, 13 tests) — run it on any change.
- `server/services/assetResolver.js` — huge junk-item-name regex (line ~181) + CDragon URL/shape normalization; brittle to upstream data changes.
- `server/services/statsAggregator.js` / `compsAggregator.js` — pure reducers with fixture tests; keep `aggregate*` pure (exported for testability).

## In progress / incomplete
- **Dead code**: `server/cache/matchStore.js` (in-memory match store, imported nowhere — legacy pre-Mongo). Delete candidate.
- **Orphan**: `client/src/pages/AboutPage.module.css` with no `AboutPage.jsx`.
- **Doc sprawl**: `CLAUDE.md` ≈ `claude.md` ≈ `AGENTS.md` (identical), plus thinner `CODEX.md` — drift risk; no single canonical.
- **Active area**: LP system + ingestion — recent commits add `patchToNum`/`getCurrentPatchWindow` to `statsAggregator` for current-patch-only daemon ingestion; LP estimation + decay/placement logic recently reworked. Expect churn here.
- **Not started**: shared client/server package for set/region constants (would need workspace/build change); the mixed-concern file splits above.
