import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { groupHeaderSearchResults } from './headerSearch'

const searchSource = readFileSync(
  fileURLToPath(new URL('../ui/HeaderSearch.vue', import.meta.url)),
  'utf8',
)

describe('header search results', () => {
  it('groups rules, handbook items and suggests by their concrete types', () => {
    const groups = groupHeaderSearchResults([
      { key: 'rule-checks', kind: 'rule', typeId: 'player-rules', typeLabel: 'Правила' },
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
      { key: 'rule:player-rules', label: 'Правила', results: [['rule-checks', 0]] },
      { key: 'item:5', label: 'Заклинания', results: [['item-1', 1], ['item-3', 2]] },
      { key: 'item:6', label: 'Бестиарий', results: [['item-2', 3]] },
      { key: 'suggest:7', label: 'Школы', results: [['sug-1', 4], ['sug-2', 5]] },
    ])
  })

  it('mixes local rules into the common search and links straight to an article', () => {
    expect(searchSource).toContain("import { searchPlayerRuleEntries } from '@/features/handbook/rules/lib/playerRules'")
    expect(searchSource).toContain("typeLabel: 'Правила'")
    expect(searchSource).toContain("name: 'PlayerRuleArticle'")
    expect(searchSource).toContain("hash: `#${section.id}`")
    expect(searchSource).toContain('results.value = [...ruleResults, ...itemResults, ...suggestResults]')
  })

  it('animates the dropdown, groups and changing result rows', () => {
    expect(searchSource).toContain('<Transition name="hs-dropdown">')
    expect(searchSource).toContain('<TransitionGroup name="hs-results"')
    expect(searchSource).toContain('name="hs-groups"')
    expect(searchSource).toContain('.hs-results-move')
    expect(searchSource).toContain('.hs-groups-move')
  })
})
