import { describe, expect, it } from 'vitest'
import { graphEdgeMidpoint, graphEdgePath, graphEdgePathToPoint } from './graphGeometry'

describe('graph edge geometry', () => {
  const dimensions = node => ({ width: node.width, height: node.height })
  const from = { positionX: 100, positionY: 80, width: 200, height: 120 }
  const to = { positionX: 500, positionY: 300, width: 240, height: 160 }

  it('connects the facing card sides with a directed curve', () => {
    expect(graphEdgePath(from, to, dimensions)).toBe('M 300 140 C 390 140, 410 380, 500 380')
  })

  it('uses the centred top and bottom ports for vertically separated cards', () => {
    const below = { positionX: 120, positionY: 400, width: 180, height: 100 }
    expect(graphEdgePath(from, below, dimensions)).toBe('M 200 200 C 200 290, 210 310, 210 400')
    expect(graphEdgePath(below, from, dimensions)).toBe('M 210 400 C 210 310, 200 290, 200 200')
  })

  it('ends a temporary edge exactly at the pointer and changes its source side', () => {
    expect(graphEdgePathToPoint(from, { x: 500, y: 200 }, dimensions)).toBe('M 300 140 C 390 140, 410 200, 500 200')
    expect(graphEdgePathToPoint(from, { x: 210, y: 400 }, dimensions)).toBe('M 200 200 C 200 290, 210 310, 210 400')
    expect(graphEdgePathToPoint(from, { x: 180, y: -100 }, dimensions)).toBe('M 200 80 C 200 -1, 180 -19, 180 -100')
  })

  it('places labels between card centers', () => {
    expect(graphEdgeMidpoint(from, to, dimensions)).toEqual({ x: 410, y: 260 })
  })
})
