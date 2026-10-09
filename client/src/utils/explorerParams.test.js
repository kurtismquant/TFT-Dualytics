// Run with: node --test client/src/utils/explorerParams.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { filtersToSearch, hasFilters, parseExplorerParams, serializeFilters } from './explorerParams.js'

const filters = {
  units: [
    { id: 'DA_18_Ahri', minStar: 2, maxStar: 3, items: ['DA_InfinityEdge', 'DA_GiantSlayer'] },
    { id: 'DA_18_Sett', items: [] },
    { id: 'DA_18_Kennen', items: ['DA_Morellonomicon'] },
  ],
  traits: [{ id: 'DA_18_Blossom', minTier: 2 }, { id: 'DA_18_Brawler' }],
  items: ['DA_RabadonsDeathcap'],
}

test('serializes filters in the API format', () => {
  assert.deepEqual(serializeFilters(filters), {
    units: 'DA_18_Ahri:2-3:DA_InfinityEdge+DA_GiantSlayer,DA_18_Sett,DA_18_Kennen::DA_Morellonomicon',
    traits: 'DA_18_Blossom:2,DA_18_Brawler',
    items: 'DA_RabadonsDeathcap',
  })
  assert.deepEqual(serializeFilters({ units: [], traits: [], items: [] }), {})
})

test('round-trips through the URL', () => {
  const search = filtersToSearch(filters)
  assert.equal(search.get('t'), 'DA_18_Blossom:2,DA_18_Brawler')
  assert.deepEqual(parseExplorerParams(search), filters)
})

test('drops malformed entries', () => {
  const params = new URLSearchParams('u=bad;id,DA_18_Ahri:9-x&t=DA_18_Blossom:0&i=,DA_IE')
  assert.deepEqual(parseExplorerParams(params), {
    units: [{ id: 'DA_18_Ahri', items: [] }],
    traits: [{ id: 'DA_18_Blossom' }],
    items: ['DA_IE'],
  })
  assert.equal(hasFilters(parseExplorerParams(new URLSearchParams())), false)
})
