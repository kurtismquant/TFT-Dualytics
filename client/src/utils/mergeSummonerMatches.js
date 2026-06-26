// Merge logic for incremental single-player match-history polls.
//
// During a sync the page polls every second. Re-pulling the whole history from the
// remote Atlas link each tick is the dominant cost, so the server returns only matches
// newer than a `since` cursor; this merges that slice into what the client already holds.
// Kept as pure functions (no React/React Query) so they're unit-testable with node:test.

// Union prev + incoming matches, dedup by matchId (incoming wins — it's the fresher copy),
// re-sort newest-first. rankInfo/rankSnapshots/summoner/sync/cache come from the response
// (authoritative latest); participantRanks is merged so opponents from older matches survive.
// lastMatchAt is recomputed from the merged set since the incremental cache only reflects
// the new slice (and is null when no new matches arrived).
export function mergeSummonerMatches(prev, res) {
  const byId = new Map()
  for (const m of prev?.matches ?? []) byId.set(m.matchId, m)
  for (const m of res?.matches ?? []) byId.set(m.matchId, m)
  const matches = [...byId.values()].sort((a, b) => b.date - a.date)

  return {
    ...res,
    matches,
    participantRanks: {
      ...(prev?.participantRanks ?? {}),
      ...(res?.participantRanks ?? {}),
    },
    cache: {
      ...res?.cache,
      lastMatchAt: matches[0]?.date ?? res?.cache?.lastMatchAt ?? null,
    },
  }
}

// True when the merged set has drifted from the server's authoritative total and a full
// reload is warranted. Only checked once the sync has settled: web detail fetches land
// out of order, so a newest-date cursor can transiently skip an older-but-just-written
// match mid-sync — we tolerate that until completion, then reconcile if counts disagree.
// (Also self-corrects a TTL-expired match the client still holds: local length > count.)
export function needsReconcile(merged) {
  const count = merged?.cache?.matchCount
  if (merged?.sync?.state === 'syncing') return false
  if (count == null) return false
  return (merged.matches?.length ?? 0) !== count
}
