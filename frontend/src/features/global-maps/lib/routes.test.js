import { describe, expect, it } from 'vitest'
import { reorderVisits, routeLegs, routePath } from './routes'

describe('global route geometry', () => {
  it('bends even a two-point route and preserves exact endpoints', () => {
    const path = routePath([{ x: .1, y: .5 }, { x: .9, y: .5 }], 1000, 600)
    expect(path.startsWith('M100,300 C')).toBe(true)
    expect(path.endsWith('900,300')).toBe(true)
    const controls = path.split(' C')[1].split(' ')
    expect(Number(controls[0].split(',')[1])).toBeGreaterThan(300)
    expect(Number(controls[1].split(',')[1])).toBeGreaterThan(300)
  })
  it('keeps curved controls within the image and handles overlapping points', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 }]
    const path = routePath(points, 100, 60)
    expect(path.match(/C/g)).toHaveLength(3)
    for (const pair of path.matchAll(/([\d.]+),([\d.]+)/g)) {
      expect(Number(pair[1])).toBeLessThanOrEqual(100)
      expect(Number(pair[2])).toBeLessThanOrEqual(60)
    }
    expect(path).not.toMatch(/NaN|Infinity/)
    expect(routePath([], 100, 60)).toBe('')
    expect(routePath([points[0]], 100, 60)).toBe('')
  })
  it('reorders only the selected point while preserving its identity and note', () => {
    const route = { points: [{ id: 'a' }, { id: 'b', note: 'Привал' }, { id: 'c' }] }
    reorderVisits(route, ['b', 'a', 'c'])
    expect(route.points.map(point => point.id)).toEqual(['b', 'a', 'c'])
    expect(route.points[0].note).toBe('Привал')
    reorderVisits(route, ['b', 'a', 'c'])
    expect(route.points.map(point => point.id)).toEqual(['b', 'a', 'c'])
  })
})


describe('independent route legs', () => {
  const stops = () => [
    { id: 'a', x: .1, y: .2 }, { id: 'bend', control: true, x: .3, y: .4 },
    { id: 'b', x: .5, y: .3 }, { id: 'c', x: .8, y: .8 },
  ]
  it('keeps preceding leg geometry and dash origin when adding or editing distant stops', () => {
    const points = stops(), original = routeLegs(points, 1200, 800)
    points.push({ id: 'd', x: .9, y: .1 })
    points[3].x = .6
    const changed = routeLegs(points, 1200, 800)
    expect(changed[0]).toEqual(original[0])
    expect(changed[1].path.startsWith('M600,240 ')).toBe(true)
    expect(changed[0].segments.map(segment => segment.index)).toEqual([0, 1])
    expect(changed[1].segments[0].index).toBe(2)
  })
  it('keeps bends with surviving pairs, reverses them for return legs and removes orphaned bends', () => {
    const route = { points: stops() }
    reorderVisits(route, ['c', 'b', 'a'])
    expect(route.points.map(point => point.id)).toEqual(['c', 'b', 'bend', 'a'])
    reorderVisits(route, ['b', 'c', 'a'])
    expect(route.points.map(point => point.id)).toEqual(['b', 'c', 'a'])
  })
  it('rejects incomplete or duplicate orders without changing points', () => {
    const route = { points: stops() }, original = route.points
    for (const ids of [['a', 'b'], ['a', 'a', 'c'], ['a', 'b', 'missing']]) {
      reorderVisits(route, ids)
      expect(route.points).toBe(original)
    }
  })
})
