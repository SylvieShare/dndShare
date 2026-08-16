import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionSettingsKey, useSessionSettings } from './useSessionSettings'

afterEach(() => vi.unstubAllGlobals())

describe('session settings', () => {
  it('restores and saves browser-local preferences per session', async () => {
    const values = new Map([[sessionSettingsKey('abc'), JSON.stringify({ hideCanvasLegend: true })]])
    const storage = {
      getItem: vi.fn(key => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    }
    vi.stubGlobal('localStorage', storage)

    const { settings, update } = useSessionSettings({ sessionUuid: 'abc' })
    expect(settings).toMatchObject({ hideCanvasLegend: true, autoRollNpcHp: false })
    update('autoRollNpcHp', true)
    await nextTick()

    expect(JSON.parse(values.get(sessionSettingsKey('abc')))).toEqual({
      hideCanvasLegend: true,
      autoRollNpcHp: true,
    })
  })
})
