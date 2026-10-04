import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWeaponCalc } from './useWeaponCalc'
import { useWeaponDamageRolls } from './useWeaponDamageRolls'
import { twoWeaponFightingOption } from '../lib/twoWeaponFighting'
import { withWeaponThrowAction, THROW_ACTION_KEY } from '../lib/weaponThrow'

const roll = vi.hoisted(() => vi.fn(() => ({ total: 7 })))
vi.mock('@/stores/dice', () => ({ useDiceStore: () => ({ roll }) }))

function fixture(stat = 4, effects = []) {
  const item = { id: 1, name: 'Кинжал +2', data: { tags: ['Лёгкое', 'Фехтовальное', 'Метательное'] } }
  const entry = { uid: 'dagger', item_id: 1, proficient: true, params: { magic_bonus: 2 } }
  const actions = withWeaponThrowAction([{ key: 'sneak', label: 'Скрытая атака', dice: 'd6', dice_count: 2 }], item)
  const bonusActionDamageOption = row => twoWeaponFightingOption(row, item, [], effects)
  const calc = useWeaponCalc({ statsVar: ref({ 1: stat, 2: stat }), profBonus: ref(3),
    diceMap: ref({ d4: 'd4', d6: 'd6' }), diceDetailsMap: ref({}),
    damageTypeMap: ref({ 3: 'Колющий' }), damageTypeDetailsMap: ref({}),
    item: () => item, propertyItems: () => [], itemBaseAttacks: () => [{ count: 1, dice_id: 'd4', type: 3 }],
    damageBonusModifier: () => 1, bonusActionDamageOption })
  const spend = vi.fn(() => true)
  const damage = useWeaponDamageRolls({ ownerMode: true, values: {} }, { ...calc, item: () => item,
    propertyItems: () => [], weaponDamageActions: () => actions, bonusActionDamageOption,
    extraCriticalDice: () => 0, itemTitle: () => item.name, spend })
  return { calc, damage, entry, item, effects, spend }
}

beforeEach(() => roll.mockClear())
describe('bonus action damage preview and rolls', () => {
  it('omits only positive ability damage, keeping magic, other bonuses and the attack modifier', () => {
    const { calc, damage, entry } = fixture()
    expect(damage.damagePreview(entry, {})).toBe('1d4{Колющий}+7{Колющий}')
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe('1d4{Колющий}+3{Колющий}')
    expect(calc.attackBonus({ ...entry, _bonusActionDamage: true })).toBe(9)
    expect(entry).not.toHaveProperty('_bonusActionDamage')
  })

  it.each([-3, 0])('preserves non-positive ability modifier %i', stat => {
    const { damage, entry } = fixture(stat)
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe(damage.damagePreview(entry, {}))
  })

  it('restores the ability modifier once, even with several style sources', () => {
    const { damage, entry } = fixture(4, [{ kind: 'two_weapon_damage_modifier' }, { kind: 'two_weapon_damage_modifier' }])
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe('1d4{Колющий}+7{Колющий}')
    expect(damage.damagePreview(entry, { bonusAction: true, critical: true })).toBe('2d4{Колющий}+7{Колющий}')
  })

  it('uses the same typed formula for preview and roll, including thrown and critical extra dice', () => {
    const { damage, entry, spend } = fixture()
    const options = { bonusAction: true, critical: true, twoHanded: true, actionKeys: [THROW_ACTION_KEY, 'sneak'] }
    const preview = damage.damagePreview(entry, options)
    expect(preview).toBe('2d4{Колющий}+3{Колющий}+4d6{Колющий}')
    damage.rollDamage(entry, options)
    expect(roll).toHaveBeenCalledWith('Критический урон (бонусное действие): Кинжал +2 — Метнуть, Скрытая атака', preview,
      expect.objectContaining({ minimumTotal: 0, eventData: expect.objectContaining({ damageRoll: true, bonusAction: true }) }))
    expect(spend).toHaveBeenCalledOnce()
  })

  it('ignores a stale option once the weapon stops qualifying and reacts to a removed style', () => {
    const { damage, entry, item, effects } = fixture(4, [{ kind: 'two_weapon_damage_modifier' }])
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe('1d4{Колющий}+7{Колющий}')
    effects.length = 0
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe('1d4{Колющий}+3{Колющий}')
    item.data.tags = ['Двуручное']
    expect(damage.damagePreview(entry, { bonusAction: true })).toBe('1d4{Колющий}+7{Колющий}')
  })
})
