import { describe, expect, it } from 'vitest'
import { mapDrawingUnits, pointPreviewView } from './mapDrawing'

describe('point preview projection', () => {
  it('centres edge and interior points at exactly twice the current canvas zoom', () => {
    for (const image of [{ width: 1200, height: 800 }, { width: 600, height: 2400 }]) {
      for (const scale of [.03, .5, 1, 4]) {
        for (const point of [{ x: 0, y: 0 }, { x: .4, y: .7 }, { x: 1, y: 1 }]) {
          const bounds = { width: 220, height: 150 }, style = pointPreviewView(point, image, scale, bounds)
          const [, x, y, zoom] = style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/).map(Number)
          expect(zoom).toBe(scale * 2)
          expect(x + point.x * image.width * zoom).toBeCloseTo(bounds.width / 2)
          expect(y + point.y * image.height * zoom).toBeCloseTo(bounds.height / 2)
          const units = mapDrawingUnits(image, scale)
          expect(units.route * zoom).toBeCloseTo(2 * units.route * scale)
          expect(units.marker * zoom).toBeCloseTo(2 * units.marker * scale)
        }
      }
    }
  })
})
