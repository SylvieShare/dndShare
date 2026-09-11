import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { changeSelectedTarget, selectedTargets, selectedTargetRuleError } from './selectedTarget'
import { restoreDawnResources } from './dawnResources'
import { restoreCharacterResources } from './characterResources'
import { collectCharacterDerivedEffects, derivedRollEffects } from './characterDerivedEffects'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
import { selectedWeaponDamageExpression } from '../blocks/dnd/lib/weaponDamageAction'
import { resolveRollMode } from '../blocks/dnd/lib/rollMode'
const sql = readFileSync(new URL('../../../../../internal/store/schema/105_selected_target.sql', import.meta.url), 'utf8')
const rule = JSON.parse(sql.split('$oath_target$')[1])
function fixture() {
 const item = { id: 202, typeId: 19, name: 'Лук клятвы', data: { weapon: { magic_bonus: 0 }, selected_target: structuredClone(rule), attunement: 'required' } }
 const items = new Map([['202', item]])
 const values = { lvl: { level: 8 }, weapon: ['bow', 'second'].map(uid => ({ uid, item_id: 61, magic_item_id: 202, params: { magic: { attuned: true, remaining: 4 }, note: 'keep' } })) }
 return { values, items, item }
}
const state = v => v.weapon[0].params.magic.selected_target
const mutate = (v, items, op, payload, uid = 'bow') => ({ ...v, ...changeSelectedTarget(v, items, uid, op, payload, true) })
const modes = (v, items, uid = 'bow', extra = {}) => derivedRollEffects(collectCharacterDerivedEffects(v, items), { kind: 'attack', weaponKind: 'ranged', weaponAttack: true, targetId: uid, ...extra })
it('links one named target to attack and damage without changing other instances or resources', () => {
 let { values, items } = fixture()
 values = mutate(values, items, 'declare', 'Орк')
 expect(state(values)).toMatchObject({ name: 'Орк', status: 'active', selected: true, dawns_left: 7 })
 expect(values.weapon[1].params.magic.selected_target).toBeUndefined()
 expect(values.weapon[0].params).toMatchObject({ note: 'keep', magic: { remaining: 4 } })
 expect(modes(values, items)).toMatchObject([{ mode: 'advantage' }])
 expect(modes(values, items, 'second')).toMatchObject([{ mode: 'disadvantage' }])
 for (const context of [{ kind: 'spell_attack', weaponAttack: false }, { weaponAttack: false }, { kind: 'saving_throw' }]) expect(modes(values, items, 'second', context)).toEqual([])
 expect(modes(values, items, 'bow', { weaponKind: 'melee' })).toEqual([])
 expect(modes(values, items, 'bow', { improvisedWeapon: true })).toEqual([])
 const actions = matchingWeaponDamageActions(collectCharacterCombatEffects(values, items), { weaponUid: 'bow', ranged: true })
 expect(actions).toHaveLength(1)
 expect(matchingWeaponDamageActions(collectCharacterCombatEffects(values, items), { weaponUid: 'second', ranged: true })).toEqual([])
 expect(weaponDamageMenuOptions(actions, [actions[0].key], false, 'attack')[0]).toMatchObject({ checked: true, damageParts: [] })
 expect(weaponDamageMenuOptions(actions, [actions[0].key], true, 'damage')[0].formula).toBe('+6к6')
 expect(selectedWeaponDamageExpression({ baseExpression: '1d8+3', actions, actionKeys: [actions[0].key] })).toBe('1d8+3+3d6')
 expect(resolveRollMode('auto', [...modes(values, items), { mode: 'disadvantage' }]).mode).toBe('normal')
 values = mutate(values, items, 'select', { id: state(values).id, selected: false })
 expect(modes(values, items)).toEqual([])
 expect(modes(values, items, 'second')).toHaveLength(1)
 expect(matchingWeaponDamageActions(collectCharacterCombatEffects(values, items), { weaponUid: 'bow', ranged: true })[0].target_choice.selected).toBe(false)
})
it('counts seven explicit dawns, survives rest/reload/bag and expires without consuming a charge', () => {
 let { values, items } = fixture(); values = mutate(values, items, 'declare', 'Орк')
 values = JSON.parse(JSON.stringify(values))
 for (const kind of ['short', 'long']) {
  const rest = restoreCharacterResources(values, items, kind)
  expect(state({ ...values, ...rest.patch }).dawns_left).toBe(7)
 }
 const bow = values.weapon.shift(); values.items = { sections: [{ items: [bow] }] }
 expect(modes(values, items, 'second')).toMatchObject([{ mode: 'disadvantage' }])
 expect(modes(values, items, 'bow')).toEqual([])
 for (let i = 0; i < 7; i++) {
  const result = restoreDawnResources(values, items)
  expect(result.results).toEqual([])
  values = { ...values, ...result.patch }
 }
 expect(values.items.sections[0].items[0].params.magic).toMatchObject({ remaining: 4, selected_target: { status: 'expired', dawns_left: 0, selected: false } })
 expect(modes(values, items, 'second')).toEqual([])
 expect(restoreDawnResources(values, items).targets).toEqual([])
})
it('defeat removes the penalty immediately and unlocks a new target only after dawn', () => {
 let { values, items } = fixture(); values = mutate(values, items, 'declare', 'Орк')
 const id = state(values).id
 expect(changeSelectedTarget(values, items, 'bow', 'declare', 'Дракон', true)).toEqual({})
 values = mutate(values, items, 'defeat', { id })
 expect(modes(values, items, 'second')).toEqual([])
 expect(changeSelectedTarget(values, items, 'bow', 'declare', 'Дракон', true)).toEqual({})
 expect(changeSelectedTarget(values, items, 'bow', 'defeat', { id }, true)).toEqual({})
 values = { ...values, ...restoreDawnResources(values, items).patch }
 values = mutate(values, items, 'declare', 'Дракон')
 expect(state(values).name).toBe('Дракон')
 expect(changeSelectedTarget(values, items, 'bow', 'correct', { id }, true)).toEqual({})
})
it('validates rules and permissions and suppresses properties without attunement', () => {
 let { values, items, item } = fixture()
 expect(selectedTargetRuleError(rule)).toBe('')
 expect(selectedTargetRuleError({ ...rule, duration_dawns: 0 })).toBeTruthy()
 expect(selectedTargetRuleError({ ...rule, damage: { dice: 'd0' } })).toBeTruthy()
 for (const name of ['', ' '.repeat(5), 'x'.repeat(121)]) expect(changeSelectedTarget(values, items, 'bow', 'declare', name, true)).toEqual({})
 expect(changeSelectedTarget(values, items, 'bow', 'declare', 'Орк', false)).toEqual({})
 values = mutate(values, items, 'declare', 'Орк')
 values.weapon[0].params.magic.attuned = false
 expect(modes(values, items, 'second')).toEqual([])
 expect(changeSelectedTarget(values, items, 'bow', 'select', { id: state(values).id, selected: true }, true)).toEqual({})
 expect(selectedTargets(values, items)[0].state.name).toBe('Орк')
 item.data.max_use = 5; item.data.dawn_recovery = { mode: 'full' }
 const dawn = restoreDawnResources(values, items)
 expect(dawn.patch.weapon[0].params.magic).toMatchObject({ remaining: 5, selected_target: { dawns_left: 6 } })
})
