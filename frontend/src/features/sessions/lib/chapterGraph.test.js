import { describe, expect, it } from 'vitest'
import {
  CHAPTER_PRESETS,
  CHAPTER_STATUSES,
  currentChapterLabel,
  edgeMidpoint,
  edgePath,
  romanNumeral,
} from './chapterGraph'

describe('chapter graph presentation helpers', () => {
  it('numbers reordered arcs with roman numerals', () => {
    expect(romanNumeral(1)).toBe('I')
    expect(romanNumeral(4)).toBe('IV')
    expect(romanNumeral(12)).toBe('XII')
  })

  it('keeps chapter numbers as display text', () => {
    expect(currentChapterLabel({ arcOrder: 2, number: '3А', name: 'Развилка' }))
      .toBe('Арка II · Глава 3А · Развилка')
  })

  it('exposes the complete status and image preset catalogues', () => {
    expect(CHAPTER_STATUSES.map(item => item.key)).toEqual(expect.arrayContaining([
      'draft', 'ready', 'available', 'in_progress', 'paused', 'completed', 'failed', 'skipped', 'cancelled',
    ]))
    expect(CHAPTER_PRESETS.map(item => item.key)).toEqual(expect.arrayContaining([
      'city', 'camp', 'road', 'village', 'cave', 'forest', 'ruins', 'castle', 'tavern', 'dungeon', 'mountains', 'coast',
    ]))
  })

  it('builds a directed curve and a label anchor between nodes', () => {
    const from = { positionX: 0, positionY: 40 }
    const to = { positionX: 400, positionY: 160 }
    expect(edgePath(from, to)).toMatch(/^M .+ C .+$/)
    expect(edgeMidpoint(from, to)).toEqual({ x: 318, y: 178 })
  })
})
