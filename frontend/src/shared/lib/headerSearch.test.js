import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { groupHeaderSearchResults } from './headerSearch'

const searchSource = readFileSync(
  fileURLToPath(new URL('../ui/HeaderSearch.vue', import.meta.url)),
  'utf8',
)

describe('header search results', () => {
  it('groups handbook items and suggests by their concrete types', () => {
    const groups = groupHeaderSearchResults([
      { key: 'item-1', kind: 'item', typeId: 5, typeLabel: 'Заклинания' },
      { key: 'item-2', kind: 'item', typeId: 6, typeLabel: 'Бестиарий' },
      { key: 'item-3', kind: 'item', typeId: 5, typeLabel: 'Заклинания' },
      { key: 'sug-1', kind: 'suggest', typeId: 7, typeLabel: 'Школы' },
      { key: 'sug-2', kind: 'suggest', typeId: 7, typeLabel: 'Школы' },
    ])

    expect(groups.map(group => ({
      key: group.key,
      label: group.label,
      results: group.results.map(result => [result.key, result.displayIndex]),
    }))).toEqual([
      { key: 'item:5', label: 'Заклинания', results: [['item-1', 0], ['item-3', 1]] },
      { key: 'item:6', label: 'Бестиарий', results: [['item-2', 2]] },
      { key: 'suggest:7', label: 'Школы', results: [['sug-1', 3], ['sug-2', 4]] },
    ])
  })

  it('animates the dropdown, groups and changing result rows', () => {
    expect(searchSource).toContain('<Transition name="hs-dropdown">')
    expect(searchSource).toContain('<TransitionGroup name="hs-results"')
    expect(searchSource).toContain('name="hs-groups"')
    expect(searchSource).toContain('.hs-results-move')
    expect(searchSource).toContain('.hs-groups-move')
  })
})
