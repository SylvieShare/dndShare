import { ref } from 'vue'
import { beforeEach, it, vi, expect } from 'vitest'
import { useEncounterImpacts } from './useEncounterImpacts'
import { applySessionImpact, getSaveTargets } from '@/shared/api/sessionEventsApi'
import { hpAfterDamage } from '../lib/encounterHelpers'

vi.mock('@/shared/api/sessionEventsApi', () => ({ applySessionImpact: vi.fn(), getSaveTargets: vi.fn() }))
vi.mock('@/stores/sessionEvents', () => ({ useSessionEventsStore: () => ({ refresh: async () => {} }) }))
vi.mock('../lib/participantView', () => ({ pvHpPath: () => 'values.hp' }))

beforeEach(() => vi.resetAllMocks())

function setup() {
  const persistence = { flushSave: vi.fn().mockResolvedValue(true), reconcile: vi.fn().mockResolvedValue(), saveError: ref(''), loadError: ref('') }
  const applyLocalPatches = vi.fn()
  const state = useEncounterImpacts({
    sessionUuid: 'session',
    persistence,
    findParticipant: () => ({ charUuid: 'hero' }),
    applyLocalPatches,
    predictHp: (_, amount) => hpAfterDamage({ current: 10, temp: 2 }, amount),
  })
  return { state, persistence, applyLocalPatches }
}

function result(target, current) {
  return { event: { data: { impacts: [{ target, after: { current, temp: 0 } }] } } }
}

it('previews damage before any server request, then rolls back and retries the identical action', async () => {
  getSaveTargets.mockResolvedValue({ targets: [{ kind: 'character', charUuid: 'hero', snapshot: { private: true }, hp: {} }] })
  applySessionImpact.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(result({ charUuid: 'hero' }, 6))
  const { state, persistence, applyLocalPatches } = setup()
  const target = { uid: 'hero', charId: 1, type: 'player' }
  const saving = state.applyCombatDamage([target], 5)

  expect(state.previewHp('hero')).toEqual({ current: 7, temp: 0 })
  expect(applySessionImpact).not.toHaveBeenCalled()
  await expect(saving).rejects.toThrow('Offline')
  expect(state.previewHp('hero')).toBeUndefined()
  expect(state.canRetry.value).toBe(true)
  expect(applyLocalPatches).not.toHaveBeenCalled()
  const first = structuredClone(applySessionImpact.mock.calls[0][1])

  await expect(state.applyCombatDamage([target], 6)).rejects.toThrow('Сначала повторите')
  await state.retry()
  expect(applySessionImpact.mock.calls[1][1]).toEqual(first)
  expect(first.targets).toEqual([{ target: { kind: 'character', charUuid: 'hero' } }])
  expect(applyLocalPatches).toHaveBeenCalledWith(1, [{ path: 'values.hp.current', value: 6 }, { path: 'values.hp.temp', value: 0 }])
  expect(persistence.reconcile).not.toHaveBeenCalled()
})

it('keeps confirmed NPC HP visible and retries only reconciliation when refreshing fails', async () => {
  const npc = { kind: 'npc', npcUid: 'wolf', encounterId: 2 }
  getSaveTargets.mockResolvedValue({ targets: [npc] })
  applySessionImpact.mockResolvedValue(result(npc, 4))
  const { state, persistence } = setup()
  persistence.reconcile.mockRejectedValueOnce(new Error('Sync unavailable'))

  await expect(state.applyCombatDamage([{ uid: 'wolf', type: 'npc' }], 5)).rejects.toThrow('Sync unavailable')
  expect(state.previewHp('wolf')).toEqual({ current: 4, temp: 0 })
  expect(state.canRetry.value).toBe(true)

  await state.retry()
  expect(applySessionImpact).toHaveBeenCalledOnce()
  expect(persistence.reconcile).toHaveBeenCalledTimes(2)
  expect(state.previewHp('wolf')).toBeUndefined()
  expect(state.error.value).toBe('')
})
