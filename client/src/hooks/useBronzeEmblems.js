import { useMemo } from 'react'
import { buildEmblemOptions, CRAFT_COMPONENT_IDS, craftToolsFor, traitRanges } from '../utils/bronzeComps.js'
import { makeMap } from '../utils/statsFormatting.js'

// Emblem data for the Bronze for Life page: the emblems the user can add (the
// same with or without the silver/gold option), id -> item lookups, the
// owned emblems' traits, the Spatula / Frying Pan items (icons) and the
// search's craftTools for the ones held.
export function useBronzeEmblems({ items, traits, emblemIds, hasSpatula, hasFryingPan }) {
  const emblemOptions = useMemo(() => buildEmblemOptions(items, traitRanges(traits, { includeSilverGold: true })), [items, traits])
  const itemLookup = useMemo(() => makeMap(items), [items])
  const emblemByTrait = useMemo(
    () => new Map(emblemOptions.map(option => [option.trait, itemLookup.get(option.id)])),
    [emblemOptions, itemLookup],
  )
  const toolItems = useMemo(() => ({
    spatula: itemLookup.get(CRAFT_COMPONENT_IDS.spatula),
    pan: itemLookup.get(CRAFT_COMPONENT_IDS.pan),
  }), [itemLookup])
  const craftTools = useMemo(
    () => craftToolsFor({ hasSpatula, hasFryingPan }, emblemOptions),
    [hasSpatula, hasFryingPan, emblemOptions],
  )
  const emblemTraits = useMemo(() => {
    const traitById = new Map(emblemOptions.map(option => [option.id, option.trait]))
    return emblemIds.map(id => traitById.get(id)).filter(Boolean)
  }, [emblemIds, emblemOptions])
  return { emblemOptions, itemLookup, emblemByTrait, toolItems, craftTools, emblemTraits }
}
