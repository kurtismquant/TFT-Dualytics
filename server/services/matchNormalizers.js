import { deduplicateUnits, hadUnitDoubling } from './unitUtils.js'
import { toTeamPlacement } from './teamPlacement.js'

export function normalizeUnits(units) {
  return deduplicateUnits(units || []).map(unit => ({
    id: unit.character_id,
    tier: unit.tier,
    items: unit.itemNames || [],
  }))
}

export function normalizeTraits(traits, wasDoubled = false) {
  return (traits || [])
    .filter(trait => trait.tier_current > 0)
    .map(trait => ({
      id: trait.name,
      // When the Riot API doubles all units it also doubles num_units per trait
      numUnits: wasDoubled ? Math.round(trait.num_units / 2) : trait.num_units,
      tierCurrent: trait.tier_current,
      style: trait.style,
    }))
}

export function findMatchParticipant(participants, puuid) {
  return participants?.find(participant => participant.puuid === puuid)
}

export function findParticipantPartner(participants, puuid, partnerGroupId) {
  return participants?.find(
    participant => participant.puuid !== puuid && participant.partner_group_id === partnerGroupId
  )
}

export function shapeParticipant(participant) {
  const doubled = hadUnitDoubling(participant.units)
  return {
    puuid: participant.puuid,
    gameName: participant.riotIdGameName ?? null,
    tagLine: participant.riotIdTagline ?? null,
    placement: participant.placement,
    teamPlacement: toTeamPlacement(participant.placement),
    level: participant.level,
    lastRound: participant.last_round,
    totalDamageToPlayers: participant.total_damage_to_players,
    units: normalizeUnits(participant.units),
    traits: normalizeTraits(participant.traits, doubled),
  }
}

export function shapeParticipants(participants) {
  return (participants || [])
    .map(shapeParticipant)
    .sort((a, b) => a.placement - b.placement)
}

export function normalizeMatch(match, puuid, currentSet) {
  const info = match?.info
  if (!info) return null
  if (info.tft_game_type !== 'pairs') return null
  if (info.tft_set_number !== currentSet) return null

  const participant = findMatchParticipant(info.participants, puuid)
  if (!participant) return null

  const partner = findParticipantPartner(info.participants, puuid, participant.partner_group_id)

  const doubled = hadUnitDoubling(participant.units)
  const partnerDoubled = hadUnitDoubling(partner?.units)

  return {
    matchId: match.metadata?.match_id,
    date: info.game_datetime,
    placement: participant.placement,
    teamPlacement: toTeamPlacement(participant.placement),
    level: participant.level,
    lastRound: participant.last_round,
    totalDamageToPlayers: participant.total_damage_to_players,
    units: normalizeUnits(participant.units),
    traits: normalizeTraits(participant.traits, doubled),
    partnerGroupId: participant.partner_group_id,
    partnerPlacement: partner?.placement ?? null,
    partnerPuuid: partner?.puuid ?? null,
    partnerGameName: partner?.riotIdGameName ?? null,
    partnerTagLine: partner?.riotIdTagline ?? null,
    partnerTotalDamageToPlayers: partner?.total_damage_to_players ?? null,
    partnerLevel: partner?.level ?? null,
    partnerLastRound: partner?.last_round ?? null,
    partnerUnits: normalizeUnits(partner?.units),
    partnerTraits: normalizeTraits(partner?.traits, partnerDoubled),
    allParticipants: shapeParticipants(info.participants),
  }
}
