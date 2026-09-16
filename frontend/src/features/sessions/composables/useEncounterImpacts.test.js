import { ref } from 'vue'
import { describe, it, vi, expect } from 'vitest'
import { useEncounterImpacts } from './useEncounterImpacts'
import { applySessionImpact, getSaveTargets } from '@/shared/api/sessionEventsApi'
vi.mock('@/shared/api/sessionEventsApi', () => ({ applySessionImpact: vi.fn(), getSaveTargets: vi.fn() }))
vi.mock('@/stores/sessionEvents', () => ({ useSessionEventsStore: () => ({ refresh: async () => {} }) }))
vi.mock('../lib/participantView', () => ({ pvHpPath: () => 'values.hp' }))
it('retries the identical action and blocks changing an unconfirmed damage request', async () => {
  getSaveTargets.mockResolvedValue({ targets: [{ kind: 'character', charUuid: 'hero', snapshot: { private: true }, hp: {} }] })
  applySessionImpact.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ event: { data: { impacts: [{ target: { charUuid: 'hero' }, after: { current: 7, temp: 0 } }] } } })
  const patches = vi.fn(), load = vi.fn()
  const state = useEncounterImpacts({ sessionUuid: 'session', persistence: { flushSave: async () => {}, saveError: ref(''), loadError: ref('') }, load, findParticipant: () => ({ charUuid: 'hero' }), applyLocalPatches: patches })
  const target = { uid: 'hero', charId: 1, type: 'player' }
  await expect(state.applyCombatDamage([target], 5)).rejects.toThrow('Offline')
  expect(patches).not.toHaveBeenCalled()
  const first = structuredClone(applySessionImpact.mock.calls[0][1])
  await expect(state.applyCombatDamage([target], 6)).rejects.toThrow('Сначала повторите')
  await state.applyCombatDamage([target], 5)
  expect(applySessionImpact.mock.calls[1][1]).toEqual(first)
  expect(first.targets).toEqual([{ target: { kind: 'character', charUuid: 'hero' } }])
  expect(patches).toHaveBeenCalledWith(1, [{ path: 'values.hp.current', value: 7 }, { path: 'values.hp.temp', value: 0 }])
  expect(load).toHaveBeenCalledOnce()
})
