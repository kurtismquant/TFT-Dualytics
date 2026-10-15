// Run with: node --test client/src/utils/boardState.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeBoardLink, encodeBoardLink, sanitizeBoard } from './boardState.js'

const board = {
  'cell-0-3': { championId: 'DA_18_Sett', items: ['DA_WarmogsArmor'], tier: 1, stars: true },
  'cell-0-2': { championId: 'DA_18_KhaZix', items: [], tier: 1, stars: false, chosenTraits: ['Rapidfire', 'Executioner'] },
  'cell-3-0': { championId: 'DA_18_Ashe', items: ['DA_InfinityEdge', 'DA_InfinityEdge', 'TFT_Item_Custom'], tier: 1, stars: false },
  'cell-1-1': null,
}

test('a board survives the link round trip, items, 3★ and picked traits included', () => {
  const link = encodeBoardLink(board)
  assert.equal(link, '1*02.18_KhaZix...Rapidfire-Executioner*03.18_Sett.WarmogsArmor.s*30.18_Ashe.InfinityEdge-InfinityEdge-!TFT_Item_Custom')
  assert.deepEqual(decodeBoardLink(link), {
    'cell-0-2': { championId: 'DA_18_KhaZix', items: [], tier: 1, stars: false, chosenTraits: ['Rapidfire', 'Executioner'] },
    'cell-0-3': { championId: 'DA_18_Sett', items: ['DA_WarmogsArmor'], tier: 1, stars: true },
    'cell-3-0': { championId: 'DA_18_Ashe', items: ['DA_InfinityEdge', 'DA_InfinityEdge', 'TFT_Item_Custom'], tier: 1, stars: false },
  })
})

test('an empty board has no link; malformed links decode to null', () => {
  assert.equal(encodeBoardLink({}), null)
  for (const value of ['', '1', '2*03.18_Sett', '1*93.18_Sett', '1*03', '1*03.bad id', null]) {
    assert.equal(decodeBoardLink(value), null, String(value))
  }
})

test('sanitize drops bad cells and caps items', () => {
  assert.deepEqual(sanitizeBoard({
    'cell-0-0': { championId: 'DA_18_Sett', items: ['A', 'B', 'C', 'D'], stars: 'yes' },
    'cell-9-9': { championId: 'DA_18_Sett' },
    'cell-0-1': { championId: '<script>' },
    'cell-0-2': { championId: 'DA_18_KhaZix', chosenTraits: ['Rapidfire', 'Rapidfire', 'bad trait!'] },
  }), {
    'cell-0-0': { championId: 'DA_18_Sett', items: ['A', 'B', 'C'], tier: 1, stars: false },
    'cell-0-2': { championId: 'DA_18_KhaZix', items: [], tier: 1, stars: false, chosenTraits: ['Rapidfire'] },
  })
  assert.deepEqual(sanitizeBoard(null), {})
})
