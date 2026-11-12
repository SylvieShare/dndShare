import { describe, expect, it } from 'vitest'
import { tabSelectionWeights } from './tabSelection'

const indexes = Array.from({ length: 8 }, (_, i) => i)

describe('tabbar follows the page gesture', () => {
  it('crossfades only the outgoing and incoming labels before committing the tab', () => {
    expect(tabSelectionWeights(8, indexes, .25)).toEqual([.75, .25, 0, 0, 0, 0, 0, 0])
    expect(tabSelectionWeights(8, indexes, .75)).toEqual([.25, .75, 0, 0, 0, 0, 0, 0])
    expect(tabSelectionWeights(8, indexes, .1)).toEqual([.9, .1, 0, 0, 0, 0, 0, 0])
  })

  it('follows semantic tabs when the pager wraps from the first to the last', () => {
    const wrapped = [7, 0, 1, 2, 3, 4, 5, 6]
    expect(tabSelectionWeights(8, wrapped, .75)).toEqual([.75, 0, 0, 0, 0, 0, 0, .25])
    expect(tabSelectionWeights(8, wrapped, 0)).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
  })

})
