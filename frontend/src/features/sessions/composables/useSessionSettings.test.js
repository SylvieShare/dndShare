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
    expect(settings).toMatchObject({ autoRollNpcHp: false })
    expect(settings).not.toHaveProperty('hideCanvasLegend')
    update('autoRollNpcHp', true)
    await nextTick()

    expect(JSON.parse(values.get(sessionSettingsKey('abc')))).toEqual({
      autoRollNpcHp: true,
    })
  })
})

it('saves shared permissions on the server, refreshes from live snapshots and keeps failures unchanged', async () => {
  const { ref, effectScope } = await import('vue')
  const api = await import('@/shared/api/sessionsApi')
  const save = vi.spyOn(api, 'updateSessionSetting').mockResolvedValue(undefined)
  const session = ref({ settings: { playersSeeClass: true, playersSeeRace: true, playersSeeHp: false, playersOpenSheets: true } })
  const scope = effectScope()
  const state = scope.run(() => useSessionSettings({ sessionUuid: 'shared', session }))
  expect(state.settings.playersSeeHp).toBe(false)
  await state.update('playersSeeHp', true)
  expect(save).toHaveBeenCalledWith('shared', 'playersSeeHp', true)
  expect(state.settings.playersSeeHp).toBe(true)
  expect(session.value.settings.playersSeeRace).toBe(true)
  save.mockRejectedValueOnce(new Error('offline'))
  await state.update('playersSeeClass', false)
  expect(state.settings.playersSeeClass).toBe(true)
  expect(state.error.value).toContain('Не удалось сохранить')
  session.value = { settings: { ...session.value.settings, playersOpenSheets: false } }
  await nextTick()
  expect(state.settings.playersOpenSheets).toBe(false)
  scope.stop()
  save.mockRestore()
})
