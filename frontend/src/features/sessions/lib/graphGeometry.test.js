import { describe, expect, it } from 'vitest'
import { graphEdgeMidpoint, graphEdgePath } from './graphGeometry'

describe('graph edge geometry', () => {
  const dimensions = node => ({ width: node.width, height: node.height })
  const from = { positionX: 100, positionY: 80, width: 200, height: 120 }
  const to = { positionX: 500, positionY: 300, width: 240, height: 160 }

  it('connects the facing card sides with a directed curve', () => {
    expect(graphEdgePath(from, to, dimensions)).toBe('M 300 140 C 390 140, 410 380, 500 380')
  })

  it('places labels between card centers', () => {
    expect(graphEdgeMidpoint(from, to, dimensions)).toEqual({ x: 410, y: 260 })
  })
})
