export function placementBucket(avgPlacement) {
  return Math.max(1, Math.min(4, Math.round(avgPlacement)))
}
