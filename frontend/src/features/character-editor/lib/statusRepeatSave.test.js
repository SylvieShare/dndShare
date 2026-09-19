import { expect, it } from 'vitest'
import { statusRepeatSaveDC, statusRepeatSaveResult } from './statusRepeatSave'
import { npcApplicationContext } from '@/features/sessions/lib/npcApplicationContext'
import { statusSaveBonus } from './statusMechanics'

it('uses the source DC and removes the specific instance only on success', () => {
  const instance = { uid: 'second-caster', params: { save_dc: 17 } }
  expect(statusRepeatSaveResult({ ability: 5 }, instance, { total: 16 })).toMatchObject({ success: false, ended: false })
  expect(statusRepeatSaveResult({ ability: 5 }, instance, { total: 17 })).toMatchObject({ success: true, ended: true, effectUid: 'second-caster' })
  expect(statusRepeatSaveDC({ dc: 12 }, instance)).toBe(12)
  expect(statusRepeatSaveDC({}, { params: {} })).toBeNull()
  expect(statusRepeatSaveResult({}, {}, { total: 20 })).toBeNull()
})

it('preserves NPC save proficiencies and active bonuses in the common save profile', () => {
  const npc = { name: 'Великан', data: { stats: { wis: 12 }, saving_throws: { wis: 5 } } }
  const effect = { id: 1, data: { derived_effects: [{ kind: 'save_bonus', value: 2 }] } }
  const combatant = { uid: 'giant', type: 'npc', itemId: 2, markerLetter: 'b', effectInstances: [{ uid: 'ward', effect_id: 1 }] }
  const context = npcApplicationContext(combatant, npc, new Map([['1', effect]]), true)
  expect(statusSaveBonus(context, 5)).toBe(7)
  expect(context.actor.name).toBe('Великан')
  expect(context.eventData.npcActor).toMatchObject({ uid: 'giant', letter: 'B' })
})
