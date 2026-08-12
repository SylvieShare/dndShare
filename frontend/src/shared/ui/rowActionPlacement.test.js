import { describe, expect, it } from 'vitest'
import { computeRowActionPlacement } from './rowActionPlacement'

const viewport = { viewportWidth: 360, viewportHeight: 640 }

describe('computeRowActionPlacement', () => {
  it('clamps a menu to the left and right viewport edges', () => {
    const leftEdge = computeRowActionPlacement({
      ...viewport,
      triggerRect: { left: 2, right: 32, top: 100, bottom: 130 },
      popoverWidth: 200,
      popoverHeight: 120,
      originX: 17,
      originY: 130,
    })
    const rightEdge = computeRowActionPlacement({
      ...viewport,
      triggerRect: { left: 340, right: 370, top: 100, bottom: 130 },
      popoverWidth: 200,
      popoverHeight: 120,
      originX: 355,
      originY: 130,
    })

    expect(leftEdge.left).toBe(8)
    expect(rightEdge.left).toBe(152)
  })

  it('opens above a low trigger when there is more room there', () => {
    const placement = computeRowActionPlacement({
      ...viewport,
      triggerRect: { left: 300, right: 330, top: 580, bottom: 610 },
      popoverWidth: 200,
      popoverHeight: 180,
      originX: 315,
      originY: 610,
    })

    expect(placement.opensAbove).toBe(true)
    expect(placement.top).toBe(394)
  })

  it('limits a tall menu to the larger available side', () => {
    const placement = computeRowActionPlacement({
      ...viewport,
      triggerRect: { left: 150, right: 180, top: 390, bottom: 420 },
      popoverWidth: 200,
      popoverHeight: 700,
      originX: 165,
      originY: 420,
    })

    expect(placement.opensAbove).toBe(true)
    expect(placement.maxHeight).toBe(376)
    expect(placement.top).toBe(8)
  })
})
