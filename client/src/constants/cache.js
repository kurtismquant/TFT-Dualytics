// How long champion/item/trait data counts as fresh. It only changes when the
// server restarts with a new patch or freshly extracted ability data, so an
// hour is plenty. Not Infinity: main.jsx persists the query cache to
// localStorage and refreshes the saved copy's timestamp on every save, so with
// an infinite staleTime a returning visitor would keep yesterday's response
// until the set changes. Restored data older than this refetches in the
// background while the cached copy renders.
export const STATIC_ASSET_STALE_MS = 60 * 60 * 1000
