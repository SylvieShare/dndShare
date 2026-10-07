import { describe, expect, it } from 'vitest'
import { changeSessionLighting, sessionMapDocument } from './sessionMapPresentation'

function document() {
  return {
    areas: [{ id: 'room', hidden: true }],
    lightingEnabled: true,
    sun: { enabled: true, angle: 225, elevation: 45 },
    lights: [{ id: 'torch', enabled: true }],
  }
}

describe('session map presentation', () => {
  it('inherits the prepared map until the session overrides its presentation', () => {
    const source = document()
    expect(sessionMapDocument(source, {})).toEqual(source)
    expect(sessionMapDocument(source, undefined)).toBe(source)
  })

  it('applies explicit false values and leaves the library and another session untouched', () => {
    const source = document()
    const state = { areas: { room: true } }
    changeSessionLighting(source, state, lighting => {
      lighting.enabled = false
      lighting.sun.angle = 90
      lighting.lights.torch = false
    })
    const saved = JSON.parse(JSON.stringify(state))
    const view = sessionMapDocument(source, saved)
    expect(view.areas[0].hidden).toBe(false)
    expect(view.lightingEnabled).toBe(false)
    expect(view.sun.angle).toBe(90)
    expect(view.lights[0].enabled).toBe(false)
    expect(source).toEqual(document())
    expect(sessionMapDocument(source, {}).areas[0].hidden).toBe(true)
    saved.areas.room = false
    expect(sessionMapDocument(source, saved).areas[0].hidden).toBe(true)
  })
})
