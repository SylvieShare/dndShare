import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { prepareWeaponRollEntry, withWeaponThrowAction, THROW_ACTION_KEY } from './weaponThrow'
import { useWeaponCalc } from '../composables/useWeaponCalc'
import { selectedWeaponDamageExpression } from './weaponDamageAction'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'

function fixture(tags = [], ranged = false) {
  const item = { data: { tags, is_long_range: ranged, attacks: [{ count: 1, dice_id: 'd8', type: 3 }] } }
  const entry = { uid: 'test', proficient: true, params: { magic_bonus: 3 } }
  const calc = useWeaponCalc({ statsVar: ref({ 1: 4, 2: 2 }), profBonus: ref(3),
    diceMap: ref({ d4: 'd4', d8: 'd8' }), diceDetailsMap: ref({}), damageTypeMap: ref({ 3: 'Дробящий' }), damageTypeDetailsMap: ref({}),
    item: () => item, propertyItems: () => tags.map(id => ({ id, label: id === 11 ? 'Фехтовальное' : 'Метательное' })),
    itemBaseAttacks: () => item.data.attacks, itemTwoHandedAttacks: () => [] })
  return { item, entry, calc }
}
describe('throwing weapons from their shared menu', () => {
  it.each([[[], false], [[], true], [[6], false], [[6, 11], false]])('offers a mode even without feature damage: %j, ranged %s', (tags, ranged) => {
    const { item } = fixture(tags, ranged)
    const actions = withWeaponThrowAction([], item)
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ key: THROW_ACTION_KEY, label: 'Метнуть' })
    expect(weaponDamageMenuOptions(actions, [], false, 'attack')).toHaveLength(1)
  })
  it('keeps natural thrown weapon dice, Strength, proficiency and magic bonus', () => {
    const { entry, item, calc } = fixture([6])
    const actions = withWeaponThrowAction([], item)
    const thrown = prepareWeaponRollEntry(entry, item, [], actions, [THROW_ACTION_KEY])
    expect(calc.attackBonus(thrown)).toBe(10)
    expect(calc.damageExpression(thrown)).toBe('1d8{Дробящий}+7{Дробящий}')
  })
  it('turns an unsuitable weapon into an improvised ranged attack only for this roll', () => {
    const { entry, item, calc } = fixture([])
    entry.add_attacks = [{ count: 2, dice_id: 'd8', type_suggest_id: 3 }]
    const actions = withWeaponThrowAction([], item)
    const thrown = prepareWeaponRollEntry(entry, item, [], actions, [THROW_ACTION_KEY])
    expect(calc.attackBonus(thrown)).toBe(2)
    expect(calc.damageExpression(thrown)).toBe('1d4{Дробящий}+2{Дробящий}')
    expect(calc.criticalDamageExpression(thrown)).toBe('2d4{Дробящий}+2{Дробящий}')
    expect(weaponDamageMenuOptions(actions, [THROW_ACTION_KEY], true)[0]).toMatchObject({ formulaPrefix: '→', formula: '2к4', damageParts: [{ count: 2, diceSides: 4 }] })
    expect(entry.add_attacks).toHaveLength(1)
    expect(entry.stat_suggest_id).toBeUndefined()
    expect(item.data.attacks[0].dice_id).toBe('d8')
  })
  it('reuses a magic weapon mode and its dependent dice without adding another switch', () => {
    const { item } = fixture([6])
    const actions = withWeaponThrowAction([
      { key: 'magic:throw', label: 'Бросок', attack_mode: 'thrown', dice_count: 1, dice: 'd8' },
      { key: 'magic:giant', label: 'Великан', requires_damage_key: 'magic:throw', dice_count: 1, dice: 'd8' },
    ], item)
    expect(actions).toHaveLength(2)
    expect(actions[0]).toMatchObject({ key: 'magic:throw', label: 'Метнуть' })
    expect(selectedWeaponDamageExpression({ baseExpression: '1d8+7', actions, actionKeys: actions.map(a => a.key) })).toBe('1d8+7+1d8+1d8')
  })
})
