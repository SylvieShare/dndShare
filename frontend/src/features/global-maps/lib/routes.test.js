import { describe, expect, it } from 'vitest'
import { movePoint, routePath } from './routes'

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
    movePoint(route, 'b', -1)
    expect(route.points.map(point => point.id)).toEqual(['b', 'a', 'c'])
    expect(route.points[0].note).toBe('Привал')
    movePoint(route, 'b', -1)
    expect(route.points.map(point => point.id)).toEqual(['b', 'a', 'c'])
  })
})
