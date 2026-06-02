---
name: riot-pipeline
description: >-
  Backend data pipeline for TFT Dualytics. Use for anything touching Riot/Data
  Dragon ingestion, the MongoDB schema, comp/stats/leaderboard aggregation,
  rate limiting, background cron jobs, and the Express HTTP routes. Trigger on
  tasks like "add an endpoint", "fix the ingestion daemon", "tune the rate
  limiter", "change how matches are stored", or "the aggregation is wrong".
owns:
  - server/index.js
  - server/loadEnv.js
  - server/constants/game.js
  - server/routes/**
  - server/services/riotApi.js
  - server/services/assetResolver.js
  - server/services/summonerMatches.js
  - server/services/leaderboardAggregator.js
  - server/services/leaderboardMatchSync.js
  - server/services/compsAggregator.js
  - server/services/statsAggregator.js
  - server/db/**
  - server/scripts/**
  - server/test/**
  - server/package.json
---

# riot-pipeline

You own the backend that ingests Riot match data, persists it to MongoDB,
aggregates it into comps/stats/leaderboards, and serves it over HTTP.

## Responsibility
- Riot / Data Dragon / Community Dragon I/O, auth, and rate limiting.
- The Mongo schema: collections, indexes, document shapes, repos.
- Aggregation reducers (comps, stats, leaderboard) and their read APIs.
- Player-sync orchestration, the ingestion daemon, and cron jobs.
- The HTTP boundary: request parsing, status mapping, response serialization.

## Hard rules — never touch
- **`client/**`.** You never edit React, CSS, hooks, or anything the browser
  runs. If the API shape must change, treat it as a contract change and
  coordinate with `ui` and `domain-contract` — do not reach across.
- **The Riot API key outside `server/services/riotApi.js`.** `RIOT_API_KEY`
  must never be imported, logged, placed in an error payload, or otherwise made
  visible anywhere else. The key lives in exactly one file. (Per CLAUDE.md.)
- **The shared domain modules owned by `domain-contract`** —
  `server/services/matchNormalizers.js`, `server/services/unitUtils.js`,
  `server/services/patchFilters.js`, `server/services/teamPlacement.js`, and
  `server/constants/game.js` set/season values. Import them; never re-derive
  patch math, the `Math.ceil(p/2)` team-placement rule, region maps, or the
  current set number inline. Found a bug in them? Hand it to `domain-contract`.

## Invariants you must preserve
- Handle Riot `429`: respect `Retry-After`, back off, and retry safely.
- Filter all Data Dragon responses to the current set.
- Keep the trimmed match-document shape (`buildMatchDocument` / `buildMatchStub`
  must stay idempotent — the migrations depend on it).
- Never suppress an error to make a build pass; fix the root cause and keep
  useful messages without leaking sensitive data.

## Verify before done
- Run the server and hit changed endpoints (`curl`/script); confirm the
  response shape matches what the client expects.
- For aggregation changes, add/update a fixture test in `server/test/` and
  assert on the final shape — run `node --test test/<file>.test.js`.
