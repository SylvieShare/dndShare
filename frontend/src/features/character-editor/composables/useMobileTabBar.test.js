import { describe, expect, it } from 'vitest'
import { tabBarRects, tabSelectionWeights } from './useMobileTabBar'

const layout = { width: 334, start: 8, end: 8, gap: 2, minimum: 44, selected: 84, maximum: 148 }
const indexes = Array.from({ length: 8 }, (_, i) => i)

describe('tabbar follows the page gesture', () => {
  it('crossfades only the outgoing and incoming labels before committing the tab', () => {
    expect(tabSelectionWeights(8, indexes, .25)).toEqual([.75, .25, 0, 0, 0, 0, 0, 0])
    expect(tabSelectionWeights(8, indexes, .75)).toEqual([.25, .75, 0, 0, 0, 0, 0, 0])
    expect(tabSelectionWeights(8, indexes, .1)).toEqual([.9, .1, 0, 0, 0, 0, 0, 0])
  })

  it('has no geometry step at the midpoint and keeps the other icons stationary', () => {
    const frames = [0, .49, .5, .51, 1].map(p => tabBarRects(tabSelectionWeights(8, indexes, p), layout))
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].at(-1).x + frames[i].at(-1).width).toBe(414)
      expect(frames[i][2]).toEqual(frames[0][2])
    }
    expect(frames[3][0].width - frames[1][0].width).toBeCloseTo(-.8)
    expect(frames[3][1].x - frames[1][1].x).toBeCloseTo(-.8)
    expect(frames.at(-1)[1]).toEqual({ x: 54, width: 84 })
  })

  it('follows semantic tabs when the pager wraps from the first to the last', () => {
    const wrapped = [7, 0, 1, 2, 3, 4, 5, 6]
    expect(tabSelectionWeights(8, wrapped, .75)).toEqual([.75, 0, 0, 0, 0, 0, 0, .25])
    expect(tabSelectionWeights(8, wrapped, 0)).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
  })

  it('fills a wider phone strip without changing its width during a swipe', () => {
    const wide = { ...layout, width: 530 }
    for (const progress of [0, .2, .5, .8, 1]) {
      const rects = tabBarRects(tabSelectionWeights(8, indexes, progress), wide)
      expect(rects.at(-1).x + rects.at(-1).width).toBeCloseTo(522)
    }
  })
})
