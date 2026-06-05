// Fallback snapshot for the landing hero stat numbers.
//
// On a genuine first visit there's no persisted React Query cache yet, so the
// cards would otherwise render blank while the API responds. These seed values
// let the cards paint real-looking numbers instantly; the live values from the
// API replace them within a moment (and then persist for next time, see
// PersistQueryClientProvider in main.jsx).
//
// They're intentionally biased a little LOW so the count-up animation ticks
// UPWARD to the real value (which reads better than counting down). Exactness
// doesn't matter — refresh occasionally to keep them plausible.
export const LANDING_SEED = {
  topComps: 12,
  gamesAnalyzed: 2500,
  unitsTracked: 45,
  patchGames: 2500,
  rankedPlayers: 200,
  units: 58,
}
