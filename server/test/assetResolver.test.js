import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildAbility,
  isAbilityResolved,
  isCurrentSetId,
  normalizeOverrideToken,
  selectSetEntry,
  selectSetUnits,
  unhashVariables,
} from '../services/assetResolver.js'

// Shapes mirror CDragon's cdragon/tft/en_us.json setData entries.
const setData = [
  { number: 17, mutator: 'TFTSet17', champions: [{ apiName: 'TFT17_Ahri', traits: ['Arcanist'] }] },
  { number: 18, mutator: 'TFTSet18_PVEMODE', champions: [] },
  {
    number: 18,
    mutator: 'TFTSet18',
    champions: [
      { apiName: 'TFT_BlueGolem', traits: [] },
      { apiName: 'TFT_ArmoryKeyCompleted', traits: [] },
      { apiName: 'DA_18_Xayah', traits: ['Lunar', 'Rival', 'Rapidfire'] },
      { apiName: 'DA_Vi18', traits: ['Primal', 'Brawler'] },
      { apiName: 'DA_Gromp18_AP', traits: ['Riftbeast', 'Adaptor'] },
    ],
  },
]

describe('selectSetEntry', () => {
  it('picks the base set entry over PvE/event variants', () => {
    assert.equal(selectSetEntry(setData, 18).mutator, 'TFTSet18')
    assert.equal(selectSetEntry(setData, 17).mutator, 'TFTSet17')
    assert.equal(selectSetEntry(setData, 99), null)
    assert.equal(selectSetEntry(undefined, 18), null)
  })

  it('prefers the Double Up (_PAIRS) entry when one exists', () => {
    const withPairs = [...setData, { number: 18, mutator: 'TFTSet18_PAIRS', champions: [] }]
    assert.equal(selectSetEntry(withPairs, 18).mutator, 'TFTSet18_PAIRS')
  })
})

describe('selectSetUnits', () => {
  it('keeps only traited units, whatever their apiName shape', () => {
    const ids = selectSetUnits(selectSetEntry(setData, 18)).map(c => c.apiName)
    assert.deepEqual(ids, ['DA_18_Xayah', 'DA_Vi18', 'DA_Gromp18_AP'])
  })
})

describe('isCurrentSetId', () => {
  it('matches both the legacy TFT<n>_ and the Set 18 DA_ id shapes', () => {
    assert.equal(isCurrentSetId('DA_18_Xayah', 18), true)
    assert.equal(isCurrentSetId('DA_Vi18', 18), true)
    assert.equal(isCurrentSetId('DA_Gromp18_AP', 18), true)
    assert.equal(isCurrentSetId('TFT18_Ahri', 18), true)
    assert.equal(isCurrentSetId('TFT17_Ahri', 18), false)
    assert.equal(isCurrentSetId('DA_Unit118', 18), false)
    assert.equal(isCurrentSetId('', 18), false)
  })
})

describe('unhashVariables', () => {
  it('restores FNV-1a hashed names from the @Token@ names in the description', () => {
    const desc = '(@MinUnits@) @EssencePerDeath@ Essence per kill, @EssencePerLoss@ per loss'
    const vars = { '{7a9d7f0e}': 2, '{de46577b}': 18, '{deadbeef}': 5, Plain: 1 }
    assert.deepEqual(unhashVariables(vars, desc), [
      { name: 'EssencePerDeath', value: 2 },
      { name: 'EssencePerLoss', value: 18 },
      { name: '{deadbeef}', value: 5 }, // no matching token → passes through
      { name: 'Plain', value: 1 },
    ])
  })

  it('returns plain variables unchanged in array form', () => {
    assert.deepEqual(unhashVariables([{ name: 'Damage', value: [0, 1, 2, 3] }], ''), [{ name: 'Damage', value: [0, 1, 2, 3] }])
    assert.deepEqual(unhashVariables(null, 'x'), [])
  })
})

// Shape of a Set 18 unit in CDragon's en_us.json: no variables, icon "None".
const sentry = {
  apiName: 'DA_18_Sentry',
  stats: { damage: 35, hp: 500, armor: 25, magicResist: 25, attackSpeed: 0.8 },
  ability: {
    name: 'Azure Laser',
    icon: 'None',
    variables: [],
    desc: 'Each second, deal @MagicDamageCalc1@ %i:scaleAP% magic damage and reduce Magic Resist by @MRReduction@.<rules>Burn: x</rules>',
  },
}
const realBin = {
  'Characters/DA_18_Sentry/Spells/TFT18_SentrySpell': {
    __type: 'SpellObject',
    mSpell: {
      DataValues: [{ name: 'MagicDamage', values: [0, 100, 150, 225] }],
      mSpellCalculations: {
        MagicDamageCalc1: {
          mFormulaParts: [{ mSubpart: { mDataValue: 'MagicDamage', __type: 'NamedDataValueCalculationPart' }, mRatio: 0.01, __type: 'SubPartScaledProportionalToStat' }],
          __type: 'GameCalculation',
        },
      },
    },
  },
}
const portraitUrl = 'https://cdn/tft18_sentry_square.png'

describe('buildAbility', () => {
  it('fills tokens from the curated override when CDragon has no data', () => {
    const override = { iconSpell: 'AhriR.png', tokens: { MagicDamageCalc1: [160, 240, 360], MRReduction: [10], Unfilled: null } }
    const { ability } = buildAbility(sentry, { override, ddVersion: '16.19.1', portraitUrl })
    assert.deepEqual(ability.calculations, {
      MagicDamageCalc1: [{ values: [0, 160, 240, 360] }],
      MRReduction: [{ values: [0, 10, 10, 10] }],
    })
    assert.equal(ability.iconUrl, 'https://ddragon.leagueoflegends.com/cdn/16.19.1/img/spell/AhriR.png')
    assert.equal(ability.desc.includes('<rules>'), false)
    assert.equal(isAbilityResolved(ability), true)
  })

  it('prefers real CDragon bin values over the override and reports the stale token', () => {
    const override = { tokens: { MagicDamageCalc1: [1, 2, 3], MRReduction: [10] } }
    const { ability, fromBin, shadowed } = buildAbility(sentry, { bin: realBin, override, portraitUrl })
    assert.deepEqual(ability.calculations.MagicDamageCalc1, [{ values: [0, 100, 150, 225] }])
    assert.deepEqual(ability.calculations.MRReduction, [{ values: [0, 10, 10, 10] }])
    assert.equal(fromBin, true)
    assert.deepEqual(shadowed, ['MagicDamageCalc1'])
  })

  it('never links the "None" icon; falls back to the unit portrait', () => {
    const { ability } = buildAbility(sentry, { portraitUrl })
    assert.equal(ability.iconUrl, portraitUrl)
    assert.equal(ability.calculations, undefined)
    assert.equal(isAbilityResolved(ability), false)
  })

  it('keeps a real CDragon ability icon when present', () => {
    const tristana = { ...sentry, ability: { ...sentry.ability, icon: 'ASSETS/Characters/TFT18_Tristana/HUD/Icons2D/TFT18_Tristana_E.tex' } }
    const { ability } = buildAbility(tristana, { override: { iconSpell: 'TristanaR.png' }, ddVersion: '16.19.1', portraitUrl })
    assert.equal(ability.iconUrl, 'https://raw.communitydragon.org/latest/game/assets/characters/tft18_tristana/hud/icons2d/tft18_tristana_e.png')
  })
})

// Shape of a data/abilityData.set18.json entry (extracted from the TFT client).
const ahri = {
  apiName: 'DA_18_Ahri',
  stats: { damage: 40, hp: 850, armor: 40, magicResist: 40, attackSpeed: 0.8 },
  ability: {
    name: 'Spirit Bomb',
    icon: 'None',
    variables: [],
    desc: 'Launch a spirit bomb within @AbilityCenterHexRange@ hexes. It deals @MagicDamageCalc1@ %i:scaleAP% magic damage in a @HexRadius@ hex radius, reduced by @HexPercentDamageFalloffTooltip@ per hex.',
  },
}
const ahriClient = {
  icon: '/assets/abilities/set18/DA_18_Ahri.png',
  tokens: { MagicDamageCalc1: [455, 685, 3500] },
  rows: { OrbDamage: [455, 685, 3500], AbilityCenterHexRange: [4, 4, 4], HexRadius: [3, 3, 3], HexPercentDamageFalloffTooltip: [0.21, 0.21, 0.21] },
}

describe('buildAbility with client data', () => {
  it('resolves every token and the icon from the TFT client data', () => {
    const override = { iconSpell: 'AhriR.png', tokens: { MagicDamageCalc1: [1, 2, 3], Unfilled: null } }
    const { ability, fromBin, fromClient, shadowed } = buildAbility(ahri, { client: ahriClient, override, ddVersion: '16.20.1', portraitUrl })
    assert.deepEqual(ability.calculations, {
      AbilityCenterHexRange: [{ values: [0, 4, 4, 4] }],
      MagicDamageCalc1: [{ values: [0, 455, 685, 3500] }],
      HexRadius: [{ values: [0, 3, 3, 3] }],
      HexPercentDamageFalloffTooltip: [{ values: [0, 0.21, 0.21, 0.21] }],
    })
    assert.equal(ability.iconUrl, '/assets/abilities/set18/DA_18_Ahri.png')
    assert.equal(fromBin, false)
    assert.equal(fromClient, true)
    assert.deepEqual(shadowed, ['MagicDamageCalc1']) // stale hand value, prune it
    assert.equal(isAbilityResolved(ability), true)
  })

  it('prefers client values over a CDragon bin', () => {
    const client = { icon: null, tokens: { MagicDamageCalc1: [200, 300, 450] }, rows: {} }
    const { ability, fromBin } = buildAbility(sentry, { bin: realBin, client, portraitUrl })
    assert.deepEqual(ability.calculations.MagicDamageCalc1, [{ values: [0, 200, 300, 450] }])
    assert.equal(fromBin, true)
    assert.equal(ability.iconUrl, portraitUrl) // no client icon → existing fallback chain
  })

  it('lets the override fill what the client data lacks', () => {
    const client = { icon: null, tokens: { MagicDamageCalc1: [200, 300, 450] }, rows: {} }
    const { ability, shadowed } = buildAbility(sentry, { client, override: { tokens: { MRReduction: [10] } }, portraitUrl })
    assert.deepEqual(ability.calculations.MRReduction, [{ values: [0, 10, 10, 10] }])
    assert.deepEqual(shadowed, [])
    assert.equal(isAbilityResolved(ability), true)
  })
})

describe('normalizeOverrideToken', () => {
  it('accepts hand-typed shorthands and rejects malformed entries', () => {
    assert.deepEqual(normalizeOverrideToken([5]), [{ values: [0, 5, 5, 5] }])
    assert.deepEqual(normalizeOverrideToken({ values: [0.2], percent: true }), [{ values: [0, 0.2, 0.2, 0.2], percent: true }])
    assert.deepEqual(normalizeOverrideToken([{ values: [1, 2, 3] }]), [{ values: [0, 1, 2, 3] }])
    assert.equal(normalizeOverrideToken(null), null)
    assert.equal(normalizeOverrideToken([1, 2]), null)
    assert.equal(normalizeOverrideToken({ values: ['x'] }), null)
  })
})
