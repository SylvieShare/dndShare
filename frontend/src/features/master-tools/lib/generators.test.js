import { describe, expect, it } from 'vitest'
import { generateTreasure, treasureCandidates, treasureOptionsError } from './treasureGenerator'
import { eventCandidates, generateEvent } from './journeyEvents'
const options = { level: 5, count: 2, maxRarity: 2, goldMin: 10, goldMax: 20, pool: 'all', publicOnly: true }
const item = (id, data = {}, rest = {}) => ({ id, typeId: 19, data: { rarity: 1, treasure: { weight: 10, min_level: 1, max_level: 20 }, ...data }, ...rest })
describe('treasure generation', () => {
  it('excludes private opt-ins, wrong categories, levels, rarities and unmarked items', () => {
    const all = [item(1), item(2, { rarity: 3 }), item(3, { treasure: null }), item(4, {}, { userId: 7 }), item(5, {}, { typeId: 5 }), item(6, { treasure: { weight: 10, min_level: 11, max_level: 20 } }), item(7, { treasure: { weight: 0, min_level: 1, max_level: 20 } })]
    expect(treasureCandidates(all, options).map(i => i.id)).toEqual([1])
    expect(treasureCandidates(all, { ...options, publicOnly: false }).map(i => i.id)).toEqual([1, 4])
    expect(treasureCandidates(all, { ...options, pool: 'mundane' })).toEqual([])
  })
  it('uses weights, picks without replacement and reports shortage without broadening filters', () => {
    const all = [item(1, { treasure: { weight: 1, min_level: 1, max_level: 20 } }), item(2)]
    const generated = generateTreasure(all, { ...options, count: 3 }, () => 0.5)
    expect(generated.items.map(i => i.id)).toEqual([2, 1])
    expect(generated).toMatchObject({ missing: 1, gold: 15 })
    expect(all).toHaveLength(2)
    expect(generateTreasure([item(1), item(1)], options, () => 0).items).toHaveLength(1)
  })
  it('honours coin bounds, permits coin-only results and rejects inverted or fractional inputs', () => {
    expect(generateTreasure([], { ...options, count: 0 }, () => 0).gold).toBe(10)
    expect(generateTreasure([], options, () => 0.999999).gold).toBe(20)
    expect(treasureOptionsError({ ...options, goldMin: 21 })).not.toBe('')
    expect(() => generateTreasure([], { ...options, count: 2.5 })).toThrow()
    expect(treasureOptionsError({ ...options, level: '' })).not.toBe('')
  })
})
describe('journey scenes', () => {
  it('has content for every offered location and mood and avoids immediate repeats when possible', () => {
    for (const [mode, places] of [['camp', ['wild', 'inn']], ['travel', ['road', 'wild', 'ruins']]]) {
      for (const place of places) for (const mood of ['any', 'calm', 'mystery', 'danger']) {
        const options = { mode, place, mood }, candidates = eventCandidates(options)
        expect(candidates.length).toBeGreaterThan(0)
        const scene = generateEvent(options, undefined, () => 0)
        expect(scene.scene && scene.choice && scene.outcome).toBeTruthy()
        if (candidates.length > 1) expect(generateEvent(options, scene.id, () => 0).id).not.toBe(scene.id)
      }
    }
  })
})
