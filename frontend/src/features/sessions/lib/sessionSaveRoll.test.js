import { describe, expect, it } from 'vitest'
import { sessionSaveProfile, saveTargetItemIds, saveTargetKey } from './sessionSaveRoll'
const effect = (id, rules) => [String(id), { id, typeId: 15, data: { derived_effects: rules } }]
describe('chronicle saving throws', () => {
  it('combines proficiency, manual and active effect bonuses with scoped dice', () => {
    const target = { kind: 'character', charUuid: 'hero', snapshot: { values: { DEX: { value: 16, save_up: true, save_bonuses: [{ value: 1 }] }, lvl: { level: 5 }, states: [{ effect_id: 10 }] } } }
    const items = new Map([effect(10, [{ kind: 'save_bonus', value: 2 }, { kind: 'roll_bonus', scopes: ['saving_throw'], formula: '1d4' }, { kind: 'roll_mode', mode: 'advantage', scopes: ['saving_throw'], ability_ids: [2] }])])
    expect(sessionSaveProfile(target, 2, items)).toMatchObject({ bonus: 9, formula: '1d4', mode: 'advantage' })
    expect(sessionSaveProfile(target, 1, items)).toMatchObject({ mode: 'normal' })
    expect(saveTargetItemIds(target)).toContain(10)
  })
  it('uses NPC explicit saves, effect bonuses and overrides', () => {
    const target = { kind: 'npc', encounterId: 7, npcUid: 'a', snapshot: { item: { stats: { dex: 14 }, saving_throws: { dex: 5 } }, combatant: { override: { saving_throws: { dex: 7 } }, effectInstances: [{ effect_id: 10 }] } } }
    const items = new Map([effect(10, [{ kind: 'save_bonus', value: 1 }, { kind: 'roll_mode', mode: 'disadvantage', scopes: ['saving_throw'] }])])
    expect(sessionSaveProfile(target, 2, items)).toMatchObject({ bonus: 8, mode: 'disadvantage' })
    expect(sessionSaveProfile(target, 2, items, 'normal').mode).toBe('normal')
    expect(saveTargetKey(target)).toBe('npc:7:a')
  })
  it('cancels opposite modes and applies ability minimum without changing saved values', () => {
    const target = { kind: 'character', snapshot: { values: { STR: { value: 10 }, states: [{ effect_id: 10 }] } } }
    const items = new Map([effect(10, [{ kind: 'ability_minimum', ability_ids: [1], value: 21 }, ...['advantage', 'disadvantage'].map(mode => ({ kind: 'roll_mode', mode, scopes: ['saving_throw'] }))])])
    expect(sessionSaveProfile(target, 1, items)).toMatchObject({ bonus: 5, mode: 'normal', cancelled: true })
    expect(target.snapshot.values.STR.value).toBe(10)
  })
})
