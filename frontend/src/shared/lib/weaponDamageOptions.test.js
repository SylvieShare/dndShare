import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { damageActionDisabled, damageAttackMode, selectedDamageActions, toggleDamageAction, weaponDamageDependencyError, weaponDamageMenuOptions } from './weaponDamageOptions'
import { selectedWeaponDamageExpression } from '@/features/character-editor/blocks/dnd/lib/weaponDamageAction'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from '@/features/character-editor/lib/characterCombatEffects'
import { renameWeaponDamageKey } from '@/features/items/editor/actionEditorModel'

const migration = readFileSync(new URL('../../../../internal/store/schema/90_conditional_weapon_damage.sql', import.meta.url), 'utf8')
const rules = JSON.parse(migration.match(/'\{weapon_damage\}', '(\[[\s\S]*?\])'::jsonb/)[1])

describe('Dwarven Thrower conditional damage', () => {
  it.each([
    [[], '1d8+7'], [['throw'], '1d8+7+1d8'], [['giant'], '1d8+7'], [['throw', 'giant'], '1d8+7+1d8+1d8'],
  ])('adds only eligible dice for %j', (keys, expected) => {
    expect(selectedWeaponDamageExpression({ baseExpression: '1d8+7', actions: rules, actionKeys: keys })).toBe(expected)
  })
  it('doubles all three dice on a giant critical, keeping Strength and magic once', () => {
    expect(selectedWeaponDamageExpression({ baseExpression: '2d8+7', actions: rules, actionKeys: ['throw', 'giant'], critical: true }))
      .toBe('2d8+7+2d8+2d8')
  })
  it('disables dependent choices and clears them when the parent is turned off', () => {
    expect(damageActionDisabled(rules[1], rules, [])).toBe(true)
    expect(toggleDamageAction(rules, [], 'giant', true)).toEqual([])
    expect(damageActionDisabled(rules[1], rules, ['throw'])).toBe(false)
    expect(toggleDamageAction(rules, ['throw', 'giant'], 'throw', false)).toEqual([])
    expect(damageAttackMode(rules, ['throw', 'giant'])).toBe('thrown')
    expect(damageAttackMode(rules, ['giant'])).toBe('')
  })
  it('passes structured dice to the menu and doubles only critical-eligible formulas', () => {
    const actions = [...rules, { key: 'fixed', label: 'Особый урон', dice: 'd6', dice_count: 3, double_on_critical: false }]
    const normal = weaponDamageMenuOptions(actions, [])
    const critical = weaponDamageMenuOptions(actions, ['throw', 'giant'], true)
    expect(normal[0]).toMatchObject({ formula: '+1к8', damageParts: [{ count: 1, diceLabel: 'd8', diceSides: 8 }] })
    expect(normal[1]).toMatchObject({ disabled: true, nested: true, checked: false })
    expect(critical[1]).toMatchObject({ formula: '+2к8', disabled: false, checked: true, damageParts: [{ count: 2, diceSides: 8 }] })
    expect(critical[2]).toMatchObject({ formula: '+3к6', damageParts: [{ count: 3, diceSides: 6 }] })
  })
  it('shares a mode switch between attack and damage without showing damage dice under attack', () => {
    const actions = [...rules, { key: 'sneak', label: 'Скрытая атака', dice: 'd6', dice_count: 3 }]
    let selected = toggleDamageAction(actions, [], 'throw', true)
    expect(weaponDamageMenuOptions(actions, selected, true, 'attack')).toMatchObject([
      { key: 'throw', checked: true, damageParts: [], formula: '' },
    ])
    expect(weaponDamageMenuOptions(actions, selected)[0]).toMatchObject({ key: 'throw', checked: true, formula: '+1к8' })
    selected = toggleDamageAction(actions, selected, 'giant', true)
    selected = toggleDamageAction(actions, selected, 'throw', false)
    expect(weaponDamageMenuOptions(actions, selected, false, 'attack')[0].checked).toBe(false)
    expect(weaponDamageMenuOptions(actions, selected)[1]).toMatchObject({ checked: false, disabled: true })
  })
  it('includes prerequisite switches when an attack mode depends on another option', () => {
    const actions = [
      { key: 'enabled', label: 'Условие', dice: 'd6', dice_count: 1 },
      { key: 'throw', attack_mode: 'thrown', requires_damage_key: 'enabled', dice: 'd8', dice_count: 1 },
    ]
    expect(weaponDamageMenuOptions(actions, [], false, 'attack').map(option => option.key)).toEqual(['enabled', 'throw'])
  })
  it('namespaces dependencies per owned instance and does not affect another weapon', () => {
    const item = { id: 261, name: 'Дварфийский метатель', typeId: 19,
      data: { weapon: { base_item_id: 53 }, attunement: 'none', activation: 'equipped', weapon_damage: rules } }
    const values = { lvl: { level: 7 }, items: { equipped: ['first', 'second'].map(uid => ({ uid, item_id: 261, count: 1, params: { weapon_enabled: true } })), sections: [] } }
    const effects = collectCharacterCombatEffects(values, new Map([['261', item]]))
    const first = matchingWeaponDamageActions(effects, { weaponUid: 'first' })
    const second = matchingWeaponDamageActions(effects, { weaponUid: 'second' })
    expect(first).toHaveLength(2)
    expect(first[1].requires_damage_key).toBe(first[0].key)
    expect(selectedDamageActions(first, first.map(rule => rule.key))).toHaveLength(2)
    expect(selectedDamageActions(second, [first[0].key, second[1].key])).toEqual([])
    expect(matchingWeaponDamageActions(effects, { weaponUid: 'other' })).toEqual([])
  })
})

it('keeps local dependencies when renaming and rejects missing or cyclic references', () => {
  const owner = { weapon_damage: structuredClone(rules) }
  renameWeaponDamageKey(owner, owner.weapon_damage[0], 'new_throw')
  expect(owner.weapon_damage[1].requires_damage_key).toBe('new_throw')
  expect(weaponDamageDependencyError(owner.weapon_damage, owner.weapon_damage[1])).toBe('')
  owner.weapon_damage[0].requires_damage_key = 'giant'
  expect(weaponDamageDependencyError(owner.weapon_damage, owner.weapon_damage[1])).toContain('круг')
  expect(selectedDamageActions(owner.weapon_damage, ['new_throw', 'giant'])).toEqual([])
  expect(weaponDamageDependencyError([], { key: 'x', requires_damage_key: 'gone' })).toContain('существующий')
})
