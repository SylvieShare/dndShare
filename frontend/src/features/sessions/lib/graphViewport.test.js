import { describe, expect, it } from 'vitest'
import { clampGraphPan, graphContentBounds, translateGraphPositions } from './graphViewport'

describe('graph viewport boundaries', () => {
  const frame = { left: 200, width: 800, height: 600 }
  const bounds = { minX: 100, minY: 80, maxX: 1200, maxY: 700 }

  it('derives content bounds from every node size', () => {
    expect(graphContentBounds([
      { positionX: 100, positionY: 80, width: 236, height: 156 },
      { positionX: 900, positionY: 420, width: 300, height: 280 },
    ], node => ({ width: node.width, height: node.height }))).toEqual(bounds)
  })

  it('keeps the camera center within the right and bottom content margins', () => {
    expect(clampGraphPan({ pan: { x: -1200, y: -900 }, zoom: 1, frame, bounds })).toEqual({
      x: -920,
      y: -640,
    })
  })

  it('keeps the camera center within the left and top content margins at any zoom', () => {
    expect(clampGraphPan({ pan: { x: 1000, y: 800 }, zoom: 0.5, frame, bounds })).toEqual({
      x: 710,
      y: 380,
    })
  })

  it('does not constrain an empty canvas', () => {
    expect(clampGraphPan({ pan: { x: -5000, y: 2000 }, zoom: 1, frame, bounds: null }))
      .toEqual({ x: -5000, y: 2000 })
  })

  it('waits for a measurable viewport before constraining the camera', () => {
    expect(clampGraphPan({
      pan: { x: -5000, y: 2000 },
      zoom: 1,
      frame: { left: 0, width: 0, height: 0 },
      bounds,
    })).toEqual({ x: -5000, y: 2000 })
  })
})

describe('group graph movement', () => {
  it('keeps the relative distance between selected nodes', () => {
    expect(translateGraphPositions([
      { id: 1, positionX: 100, positionY: 80 },
      { id: 2, positionX: 460, positionY: 240 },
    ], 35, -20)).toEqual([
      { id: 1, x: 135, y: 60 },
      { id: 2, x: 495, y: 220 },
    ])
  })
})
