import { describe, expect, it } from 'vitest'
import { collectCharacterResources } from './characterResources'
import { collectCharacterCombatEffects } from './characterCombatEffects'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { bindDamageResources, damageResourceCosts, spendDamageResources } from './weaponDamageResources'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
import { selectedWeaponDamageExpression } from '../blocks/dnd/lib/weaponDamageAction'
import { addStatusInstance, linkedStatusActive, statusEffectLinks, toggleLinkedStatus } from './characterStatuses'
import { collectCharacterDerivedEffects, derivedRollEffects } from './characterDerivedEffects'

function fixture(remaining = 3, data = {}) {
  const item = { id: 86, typeId: 19, name: 'Посох иссушения', data: { weapon: { base_item_ids: [37] }, activation: 'equipped', attunement: 'required', max_use: 3,
    weapon_damage: [{ key: 'withering', dice: 'd10', dice_count: 2, uses_resource: true, resource_cost: 1 }],
    feature_actions: [{ key: 'activate', title: 'Действие посоха', uses_resource: true, resource_cost: 1 }], ...data } }
  const entry = uid => ({ uid, item_id: 37, magic_item_id: 86, params: { magic: { attuned: true, remaining }, note: 'keep' } })
  const values = { lvl: { level: 4 }, weapon: [entry('first'), entry('second')] }
  const items = new Map([['86', item]])
  const actions = collectCharacterCombatEffects(values, items).weaponDamage.filter(row => row.weapon_uid === 'first')
  const resources = collectCharacterResources(values, items)
  return { values, items, item, resources, actions: bindDamageResources(actions, resources) }
}

describe('weapon damage charge transactions', () => {
  it('uses the same charge pool as actions, spending only the selected instance once', () => {
    const { values, items, actions, resources } = fixture()
    expect(actions).toHaveLength(1)
    expect(actions[0].resource.key).toBe(collectCharacterFeatureActions(values, items, resources)[0].resource.key)
    const key = actions[0].key
    const result = spendDamageResources(values, items, actions, [key, key])
    expect(result.error).toBe('')
    expect(result.patch.weapon[0]).toMatchObject({ item_id: 37, params: { note: 'keep', magic: { remaining: 2, attuned: true } } })
    expect(result.patch.weapon[1]).toEqual(values.weapon[1])
    expect(values.weapon[0].params.magic.remaining).toBe(3)
  })
  it('does not charge for selection, previews or a plain weapon roll', () => {
    const { values, items, actions } = fixture()
    const options = weaponDamageMenuOptions(actions, [actions[0].key], true)
    expect(options[0]).toMatchObject({ formula: '+4к10', resourceCost: { amount: 1 }, checked: true })
    expect(values.weapon[0].params.magic.remaining).toBe(3)
    expect(spendDamageResources(values, items, actions, []).patch).toEqual({})
    expect(weaponDamageMenuOptions([{ ...actions[0], attack_mode: 'thrown' }], [], false, 'attack')[0].resourceCost).toBeNull()
  })
  it('aggregates shared costs and keeps an invalid checked option removable', () => {
    const { values, items, actions } = fixture(1)
    const extra = { ...actions[0], key: 'second-extra' }, both = [...actions, extra], keys = both.map(row => row.key)
    expect(damageResourceCosts(both, keys).error).toContain('нужно 2')
    expect(spendDamageResources(values, items, both, keys).patch).toEqual({})
    expect(weaponDamageMenuOptions(both, keys).every(row => row.resourceError && !row.disabled)).toBe(true)
    expect(weaponDamageMenuOptions(both, [actions[0].key])[1].disabled).toBe(true)
  })
  it('rechecks current balances and ownership; prevents spending missing, inactive and invalid resources', () => {
    const { values, items, actions } = fixture()
    values.weapon[0].params.magic.remaining = 0
    expect(spendDamageResources(values, items, actions, [actions[0].key]).error).toContain('Недостаточно')
    expect(spendDamageResources(values, items, actions, [actions[0].key], false).patch).toEqual({})
    values.weapon[0].params.magic.attuned = false
    expect(spendDamageResources(values, items, actions, [actions[0].key]).error).toBe('Ресурс недоступен.')
    expect(bindDamageResources([{ ...actions[0], resource_cost: 1.5 }], [actions[0].resource])[0].resource_error).toContain('целым')
  })
  it('preserves both separate pools in one document patch', () => {
    const { values, items, actions } = fixture(3, { use_resources: [{ key: 'a', title: 'A', max_use: 3 }, { key: 'b', title: 'B', max_use: 2 }],
      weapon_damage: [{ key: 'one', uses_resource: true, resource_key: 'a' }, { key: 'two', uses_resource: true, resource_key: 'b' }] })
    const result = spendDamageResources(values, items, actions, actions.map(row => row.key))
    expect(result.error).toBe('')
    expect(result.patch.weapon[0].params.magic.resource_counts).toEqual({ a: 2, b: 1 })
    expect(collectCharacterResources({ ...values, ...result.patch }, items).map(row => row.value)).toEqual([2, 1, 3, 2])
  })
  it('combines necrotic and physical damage with separate labels, even on a critical hit', () => {
    const { actions } = fixture()
    actions[0].damage_type_label = 'Некротический'
    expect(selectedWeaponDamageExpression({ baseExpression: '2d6{Дробящий}+3{Дробящий}', actions,
      actionKeys: [actions[0].key], critical: true, damageType: 'Дробящий' }))
      .toBe('2d6{Дробящий}+3{Дробящий}+4d10{Некротический}')
  })
})

describe('target-side withering effect', () => {
  it('remains a visible link but cannot be applied to the weapon owner by its source toggle', () => {
    const { item, values } = fixture()
    item.data.status_effects = [{ key: 'withering', effect: { id: 9901 }, target: 'other', condition: 'Телосложение Сл 15' }]
    const link = statusEffectLinks(item)[0], effect = { id: 9901, data: {} }
    expect(link.effect_id).toBe(9901)
    expect(toggleLinkedStatus(values, effect, item, link)).toEqual([])
    expect(linkedStatusActive(values, item, link)).toBe(false)
  })
  it('affects only Strength and Constitution checks and saves after adding to the target', () => {
    const effect = { id: 9901, name: 'Иссушение посоха', data: { duration: { kind: 'hours', value: 1 }, derived_effects: [
      { kind: 'roll_mode', mode: 'disadvantage', scopes: ['ability_check', 'skill_check', 'saving_throw'], ability_ids: [1, 3] },
    ] } }
    const values = { states: addStatusInstance({}, effect) }
    const effects = collectCharacterDerivedEffects(values, new Map([['9901', effect]]))
    for (const kind of ['ability_check', 'skill_check', 'saving_throw']) {
      for (const id of [1, 3]) expect(derivedRollEffects(effects, { kind, abilitySuggestId: id })).toHaveLength(1)
      for (const id of [2, 4, 5, 6]) expect(derivedRollEffects(effects, { kind, abilitySuggestId: id })).toEqual([])
    }
    expect(derivedRollEffects(effects, { kind: 'attack', abilitySuggestId: 1 })).toEqual([])
    expect(values.states[0].duration).toMatchObject({ kind: 'hours', value: 1 })
  })
})
