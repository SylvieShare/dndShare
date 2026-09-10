import { describe, expect, it } from 'vitest'
import { abilityLevelContext, abilityLevelSourceLabel } from './abilityLevelSource'
import { abilityOwnerLevel, abilityScalingLabel } from './dndAbilityUses'
import { collectCharacterFeatureWidgets } from '@/features/character-editor/lib/characterFeatureWidgets'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from '@/features/character-editor/lib/characterCombatEffects'

const rule = { key: 'sneak', label: 'Скрытая атака', dice: 'd6', dice_count_level_divisor: 2, weapon_kind: 'finesse_or_ranged' }
const data = { level_source: 'class', level_class_id: 4015, class_ids: [{ id: 4015 }], weapon_damage: [rule], sheet_widgets: [{ key: 'panel', value_source: 'weapon_damage', weapon_damage_key: 'sneak' }] }
const values = { lvl: { level: 8 }, classes: [{ id: 4015, level: 3 }, { id: 2, level: 5 }], abilities_class: [{ id: 68, uid: 'feature' }] }
const items = owner => new Map([['68', { id: 68, name: 'Скрытая атака', data: owner }]])

describe('explicit ability links and class level', () => {
  it('uses only rogue levels for the panel, label and damage in a multiclass sheet', () => {
    expect(abilityOwnerLevel(data, values)).toBe(3)
    expect(collectCharacterFeatureWidgets(values, items(data))[0].value).toBe('2к6')
    expect(abilityScalingLabel(data, values)).toBe('2к6')
    expect(matchingWeaponDamageActions(collectCharacterCombatEffects(values, items(data)), { finesse: true })[0].dice_count).toBe(2)
  })
  it('does not replace a missing class with character level and explains the unavailable panel', () => {
    const withoutRogue = { ...values, classes: [{ id: 2, level: 8 }] }
    expect(abilityLevelContext(data, withoutRogue)).toEqual({ level: 0, missingClass: true })
    expect(abilityLevelContext({ class_ids: [{ id: 4015 }] }, withoutRogue)).toEqual({ level: 0, missingClass: true })
    expect(collectCharacterFeatureWidgets(withoutRogue, items(data))[0]).toMatchObject({ value: '', dice: null, unavailable: 'Нет нужного класса' })
    expect(matchingWeaponDamageActions(collectCharacterCombatEffects(withoutRogue, items(data)), { ranged: true })).toEqual([])
    expect(abilityScalingLabel(data, withoutRogue)).toBe('')
  })
  it('allows an explicit character-level rule and retains unbound race progression', () => {
    expect(abilityOwnerLevel({ ...data, level_source: 'character' }, values)).toBe(8)
    expect(abilityOwnerLevel({}, values)).toBe(8)
    expect(abilityLevelContext({ level_source: 'class' }, values)).toEqual({ level: 0, missingClass: true })
    expect(abilityLevelSourceLabel(data, () => 'Плут')).toBe('Класс: Плут')
  })
  it('resolves the selected rule after reorder and rename, with no implicit first-rule fallback', () => {
    const other = { key: 'other', label: 'Другая добавка', dice: 'd8', dice_count: 7 }
    const owner = { ...data, weapon_damage: [other, { ...rule, label: 'Новое название' }] }
    expect(collectCharacterFeatureWidgets(values, items(owner))[0].value).toBe('2к6')
    const before = matchingWeaponDamageActions(collectCharacterCombatEffects(values, items(data)), { finesse: true })[0].key
    const after = matchingWeaponDamageActions(collectCharacterCombatEffects(values, items(owner)), { finesse: true })[1].key
    expect(before).toBe(after)
    owner.weapon_damage = [other]
    expect(collectCharacterFeatureWidgets(values, items(owner))[0]).toMatchObject({ value: '', dice: null, unavailable: 'Правило урона не выбрано или удалено' })
    owner.sheet_widgets = [{ key: 'panel', value_source: 'weapon_damage' }]
    expect(collectCharacterFeatureWidgets(values, items(owner))[0].value).toBe('')
  })
  it('keeps subclass-owned progression strict while preserving single-class sheet level authority', () => {
    expect(abilityOwnerLevel({ subclass_ids: [{ id: 30 }] }, { ...values, classes: [{ id: 2, level: 3, subclass: { id: 30 } }, { id: 7, level: 5 }] })).toBe(3)
    expect(abilityOwnerLevel({ subclass_ids: [{ id: 99 }] }, values)).toBe(0)
    expect(abilityOwnerLevel(data, { lvl: { level: 6 }, classes: [{ id: 4015, level: 1 }] })).toBe(6)
  })
})
