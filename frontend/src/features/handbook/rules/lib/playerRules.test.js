import { describe, expect, it } from 'vitest'
import {
  findPlayerRule,
  normalizeRuleQuery,
  PLAYER_RULE_ARTICLES,
  searchPlayerRuleEntries,
  searchPlayerRules,
} from './playerRules'

describe('player rules catalogue', () => {
  it('has stable unique slugs and complete 2014 metadata', () => {
    const slugs = PLAYER_RULE_ARTICLES.map(article => article.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(PLAYER_RULE_ARTICLES.map(article => article.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    for (const article of PLAYER_RULE_ARTICLES) {
      expect(article.version).toBe('2014')
      expect(article.title).toBeTruthy()
      expect(article.summary).toBeTruthy()
      expect(article.sections.length).toBeGreaterThan(0)
      expect(findPlayerRule(article.slug)).toBe(article)
    }
  })

  it('normalizes Russian queries and answers conversational searches', () => {
    expect(normalizeRuleQuery('  ЧТО   даёт Ёлка ')).toBe('что дает елка')
    expect(searchPlayerRules('что можно в ход')[0]?.slug).toBe('combat-turn')
    expect(searchPlayerRules('упал в 0')[0]?.slug).toBe('health')
    expect(searchPlayerRules('где класс брони')[0]?.slug).toBe('character-sheet')
    expect(searchPlayerRules('концентрация')[0]?.slug).toBe('spellcasting')
  })

  it('returns the learning order for an empty query', () => {
    expect(searchPlayerRules('').map(article => article.slug))
      .toEqual(PLAYER_RULE_ARTICLES.map(article => article.slug))
  })

  it('indexes section headings for direct global-search links', () => {
    const [concentration] = searchPlayerRuleEntries('концентрация')
    expect(concentration.article.slug).toBe('spellcasting')
    expect(concentration.section?.id).toBe('concentration')

    const [gameLoop] = searchPlayerRuleEntries('главный цикл игры')
    expect(gameLoop.article.slug).toBe('basics')
    expect(gameLoop.section?.id).toBe('core-loop')
  })
})
