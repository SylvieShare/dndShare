import { describe, expect, it } from 'vitest'
import {
  CHAPTER_STATUSES,
  SCENE_STATUSES,
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

  it('exposes the complete status catalogue', () => {
    expect(CHAPTER_STATUSES.map(item => item.key)).toEqual(expect.arrayContaining([
      'none', 'draft', 'ready', 'available', 'in_progress', 'paused', 'completed', 'failed', 'skipped', 'cancelled',
    ]))
    expect(SCENE_STATUSES.find(item => item.key === 'none')?.label).toBe('Без статуса')
    expect(SCENE_STATUSES.find(item => item.key === 'completed')?.label).toBe('Завершён')
    expect(Object.fromEntries(CHAPTER_STATUSES.map(item => [item.key, item.color]))).toMatchObject({
      planned: 'var(--info)',
      ready: 'var(--accent-hover)',
      in_progress: 'var(--warning)',
      completed: 'var(--success)',
      failed: 'var(--danger)',
    })
  })

  it('builds a directed curve and a label anchor between nodes', () => {
    const from = { positionX: 0, positionY: 40 }
    const to = { positionX: 400, positionY: 160 }
    expect(edgePath(from, to)).toMatch(/^M .+ C .+$/)
    expect(edgeMidpoint(from, to)).toEqual({ x: 318, y: 178 })
  })
})
