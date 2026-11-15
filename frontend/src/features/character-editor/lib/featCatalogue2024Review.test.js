import { describe, expect, it } from 'vitest'
import origin from '../../../../../md/data/feat-review/2024-batch-01.json'
import martial from '../../../../../md/data/feat-review/2024-batch-02.json'
import magic from '../../../../../md/data/feat-review/2024-batch-03.json'
import styles from '../../../../../md/data/feat-review/2024-batch-04.json'
import boons from '../../../../../md/data/feat-review/2024-batch-05.json'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterDefenses } from './characterDefenses'
import { collectCharacterResources, setCharacterResourceAvailable } from './characterResources'
import { collectCharacterDerivedEffects, derivedSpeedBonuses, derivedNumericBonus } from './characterDerivedEffects'
import { abilitySpellGrantRows } from '../blocks/dnd/lib/abilitySpellGrants'

const plans = [...origin, ...martial, ...magic, ...styles, ...boons]
function fixture(id, choices = {}) {
  const spec = plans.find(row => row.id === id)
  const item = { id, typeId: 7, name: spec.name,
    data: Object.fromEntries(Object.entries(spec.fields).map(([key, change]) => [key, change.after])) }
  return { item, values: { lvl: { level: 19 }, abilities_feats: [{ id, choices }] },
    items: new Map([[String(id), item]]) }
}

describe('2024 feat catalogue integration', () => {
  it('uses the 2024 Shield Bash timing and shield proficiency requirement', () => {
    const { values, items, item } = fixture(7135)
    expect(item.data.prereq.armor_prof).toEqual([14])
    const actions = collectCharacterFeatureActions(values, items)
    expect(actions.map(row => row.action_type).sort()).toEqual(['reaction', 'special'])
    const bash = actions.find(row => row.action_type === 'special')
    expect(bash.description).toContain('попадаете')
    expect(bash.description).toContain('спасбросок Силы')
  })

  it('applies only the selected energy resistances and updates them on choice changes', () => {
    const { values, items } = fixture(7175, { energy: [5, 13] })
    expect(collectCharacterDefenses(values, items).map(row => row.damage_type)).toEqual([5, 13])
    values.abilities_feats[0].choices.energy = [7, 11]
    expect(collectCharacterDefenses(values, items).map(row => row.damage_type)).toEqual([7, 11])
  })

  it('keeps the recovery dice pool independent from Last Stand', () => {
    const { values, items } = fixture(7168)
    const resources = collectCharacterResources(values, items)
    expect(resources.map(row => row.total)).toEqual([10, 1])
    const dice = resources.find(row => row.source.resourceKey === 'recovery_dice')
    const changed = { ...values, ...setCharacterResourceAvailable(values, items, dice.key, 9) }
    expect(collectCharacterResources(changed, items).map(row => row.value)).toEqual([9, 1])
    const actions = collectCharacterFeatureActions(values, items, resources)
    expect(actions.map(row => row.resource.source.resourceKey)).toEqual(['recovery_dice', 'last_stand'])
  })

  it('grants revised spells using the increased casting ability and separate free-use pools', () => {
    const { item, values, items } = fixture(7124, { ability: [4], touched_spell: [6072] })
    const spells = abilitySpellGrantRows([item], values)
    expect(spells.map(row => [row.spellId, row.castingAbility, row.slotless])).toEqual([
      [6240, 4, false], [6072, 4, false],
    ])
    expect(collectCharacterResources(values, items).map(row => row.total)).toEqual([1, 1])
  })

  it('limits the crafter picker to the eight tools from Fast Crafting', () => {
    const { item } = fixture(7113)
    expect(item.data.choices[0].options.map(row => row.value).sort((a, b) => a - b))
      .toEqual([19, 21, 30, 301, 304, 306, 311, 316])
  })

  it('applies speed and archery bonuses with the correct scope', () => {
    const speedy = fixture(7119)
    expect(derivedSpeedBonuses(collectCharacterDerivedEffects(speedy.values, speedy.items)).total).toBe(10)
    const archery = fixture(7166)
    const effects = collectCharacterDerivedEffects(archery.values, archery.items)
    expect(derivedNumericBonus(effects, 'weapon_attack_bonus', archery.values, { weaponKind: 'ranged' }).total).toBe(2)
    expect(derivedNumericBonus(effects, 'weapon_attack_bonus', archery.values, { weaponKind: 'melee' }).total).toBe(0)
  })
})
