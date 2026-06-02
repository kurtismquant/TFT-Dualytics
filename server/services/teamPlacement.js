// Riot returns Double Up placements on a 1-8 scale (one rank per player).
// Double Up is 4 teams of 2 and partners always share a team rank, so the
// team placement is the 1-4 scale produced by Math.ceil(playerPlacement / 2).
// Single source of truth — imported by the normalizer and both aggregators so
// the "4 teams of 2" rule is never re-derived inline.
export const toTeamPlacement = (playerPlacement) => Math.ceil(playerPlacement / 2)
