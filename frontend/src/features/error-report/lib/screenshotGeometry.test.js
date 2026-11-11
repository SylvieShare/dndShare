import { describe, expect, it } from 'vitest'
import { planAncestorCrop, scrollOffsetBetween } from './screenshotGeometry'

describe('planAncestorCrop', () => {
  it('uses coordinates relative to the painted ancestor', () => {
    const plan = planAncestorCrop(
      { left: 80, top: 280, width: 640, height: 150 },
      { left: 0, top: 45, width: 1280, height: 720 },
    )

    expect(plan.render).toMatchObject({ width: 1280, height: 720 })
    expect(plan.crop).toEqual({ left: 80, top: 235, width: 640, height: 150 })
  })

  it('clips a transformed element at the ancestor edge', () => {
    const plan = planAncestorCrop(
      { left: -20, top: 10, width: 200, height: 100 },
      { left: 0, top: 0, width: 160, height: 80 },
    )

    expect(plan.crop).toEqual({ left: 0, top: 10, width: 160, height: 70 })
  })

  it('sums nested scroll offsets up to the capture root', () => {
    const root = { scrollLeft: 3, scrollTop: 10, parentElement: null }
    const scroller = { scrollLeft: 7, scrollTop: 365, parentElement: root }
    const parent = { scrollLeft: 0, scrollTop: 0, parentElement: scroller }
    const element = { parentElement: parent }

    expect(scrollOffsetBetween(element, root)).toEqual({ left: 10, top: 375 })
    expect(scrollOffsetBetween(root, root)).toEqual({ left: 0, top: 0 })
  })
})
