import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { damageAmountActions } from './weaponDamageAmounts'
import { weaponDamageActionFormula, weaponDamageMenuOptions } from './weaponDamageOptions'
import { collectCharacterCombatEffects } from '@/features/character-editor/lib/characterCombatEffects'
import { collectCharacterResources } from '@/features/character-editor/lib/characterResources'
import { bindDamageResources, spendDamageResources } from '@/features/character-editor/lib/weaponDamageResources'

const sql = readFileSync(new URL('../../../../internal/store/schema/100_weapon_damage_units.sql', import.meta.url), 'utf8')
const rule = JSON.parse(sql.split('$striking$')[1])
function fixture(remaining = 10) {
  const items = new Map([['189', { id: 189, name: 'Посох ударов', typeId: 19, data: { weapon: { base_item_id: 37 }, max_use: 10, activation: 'equipped', attunement: 'required', weapon_damage: [rule] } }]])
  const entry = uid => ({ uid, item_id: 37, magic_item_id: 189, params: { magic: { attuned: true, remaining } } })
  const values = { lvl: { level: 5 }, weapon: [entry('a'), entry('b')] }
  const actions = bindDamageResources(collectCharacterCombatEffects(values, items).weaponDamage.filter(a => a.weapon_uid === 'a'), collectCharacterResources(values, items))
  return { values, items, actions, key: actions[0].key }
}
it('starts at zero without extra dice or a charge spent', () => {
  const { values, items, actions } = fixture()
  const option = weaponDamageMenuOptions(actions, [])[0]
  expect(option).toMatchObject({ units: { max: 3, value: 0 }, checked: false, damageParts: [], resourceCost: null })
  expect(spendDamageResources(values, items, actions, []).patch).toEqual({})
})
it.each([1, 2, 3])('adds %i dice, doubles only dice at critical, and spends once on the selected copy', amount => {
  const { values, items, actions, key } = fixture()
  const amounts = { [key]: amount }, selected = damageAmountActions(actions, amounts)
  expect(weaponDamageActionFormula(selected[0])).toBe(`${amount}d6`)
  expect(weaponDamageActionFormula(selected[0], true)).toBe(`${amount * 2}d6`)
  expect(values.weapon[0].params.magic.remaining).toBe(10)
  const result = spendDamageResources(values, items, actions, [key, key], true, amounts)
  expect(result.error).toBe('')
  expect(result.patch.weapon[0].params.magic.remaining).toBe(10 - amount)
  expect(result.patch.weapon[1]).toEqual(values.weapon[1])
})
it('limits available cells by shared costs and rechecks the balance before spending', () => {
  const { values, items, actions, key } = fixture(3)
  const extra = { ...actions[0], key: 'other', resource_units_max: undefined, resource_cost: 1 }
  const both = [...actions, extra]
  expect(weaponDamageMenuOptions(both, ['other'])[0].units.available).toBe(2)
  expect(spendDamageResources(values, items, both, [key, 'other'], true, { [key]: 3 }).error).toContain('Недостаточно')
  values.weapon[0].params.magic.remaining = 1
  expect(spendDamageResources(values, items, actions, [key], true, { [key]: 2 }).patch).toEqual({})
  expect(weaponDamageMenuOptions(actions, [key], false, 'damage', false, { [key]: 3 })[0].units.value).toBe(3)
})
it.each([-1, 0, 4, 1.5, NaN])('rejects invalid paid selection %s without changing charges', amount => {
  const { values, items, actions, key } = fixture()
  const result = spendDamageResources(values, items, actions, [key], true, { [key]: amount })
  expect(result.error).toBeTruthy()
  expect(result.patch).toEqual({})
})
it('does not permit a reader to spend or count the same base rule twice', () => {
  const { values, items, actions, key } = fixture()
  expect(spendDamageResources(values, items, actions, [key], false, { [key]: 1 }).error).toBeTruthy()
  expect(actions[0].dice_count).toBe(1)
  expect(actions[0].resource_cost).toBe(1)
})
