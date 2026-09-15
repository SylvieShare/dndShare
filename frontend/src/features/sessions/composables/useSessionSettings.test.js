import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionSettings } from './useSessionSettings'
import * as api from '@/shared/api/sessionsApi'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup() {
  const session = ref({ settings: {
    players: { seeClass: true, seeRace: true, seeHp: false, openSheets: true },
    combat: { autoRollNpcHp: false },
  } })
  const scope = effectScope()
  const state = scope.run(() => useSessionSettings({ sessionUuid: 'shared', session }))
  return { session, scope, state }
}

describe('session settings', () => {
  it('saves combat settings through the API without reading or writing browser storage', async () => {
    const storage = { getItem: vi.fn(() => '{"autoRollNpcHp":true}'), setItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    const save = vi.spyOn(api, 'updateSessionSetting').mockResolvedValue(undefined)
    const { session, scope, state } = setup()
    expect(state.settings.combat.autoRollNpcHp).toBe(false)
    await state.update('combat.autoRollNpcHp', true)
    expect(save).toHaveBeenCalledWith('shared', 'combat.autoRollNpcHp', true)
    expect(session.value.settings.combat.autoRollNpcHp).toBe(true)
    expect(session.value.settings.players.seeRace).toBe(true)
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    scope.stop()
  })

  it('preserves values after failed saves and applies live snapshots from another browser', async () => {
    const save = vi.spyOn(api, 'updateSessionSetting').mockResolvedValue(undefined)
    const { session, scope, state } = setup()
    await state.update('players.seeHp', true)
    expect(state.settings.players.seeHp).toBe(true)
    save.mockRejectedValueOnce(new Error('offline'))
    await state.update('players.seeClass', false)
    expect(state.settings.players.seeClass).toBe(true)
    expect(state.error.value).toContain('Не удалось сохранить')
    session.value = { settings: { players: { ...session.value.settings.players, openSheets: false }, combat: { autoRollNpcHp: true } } }
    await nextTick()
    expect(state.settings.players.openSheets).toBe(false)
    expect(state.settings.combat.autoRollNpcHp).toBe(true)
    scope.stop()
  })

  it('serializes saves and merges a successful change with the latest live values', async () => {
    let finish
    const save = vi.spyOn(api, 'updateSessionSetting').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { session, scope, state } = setup()
    const pending = state.update('combat.autoRollNpcHp', true)
    expect(state.saving.value).toBe(true)
    await state.update('players.seeHp', true)
    expect(save).toHaveBeenCalledTimes(1)
    session.value.settings = { ...session.value.settings, players: { ...session.value.settings.players, seeRace: false } }
    await nextTick()
    finish()
    await pending
    expect(state.saving.value).toBe(false)
    expect(session.value.settings.players.seeRace).toBe(false)
    expect(session.value.settings.combat.autoRollNpcHp).toBe(true)
    await state.update('ownerUserId', true)
    expect(save).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
