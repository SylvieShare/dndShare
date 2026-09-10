import { describe, expect, it } from 'vitest'
import { featureEntries, MAGIC_VALUE_ID, patchFeatureEntries, updateMagicItemState } from './characterMagicItems'
import { collectCharacterResources, restoreCharacterResources, resourceItemIds, setCharacterResourceAvailable } from './characterResources'
import { collectCharacterDerivedEffects, derivedArmorRules, derivedNumericBonus } from './characterDerivedEffects'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { ownedAbilityStatusSource, toggleLinkedStatus } from './characterStatuses'
import { collectCharacterFeatureWidgets } from './characterFeatureWidgets'
import { collectCharacterDefenses } from './characterDefenses'
import { collectCharacterCombatEffects } from './characterCombatEffects'
import { collectCharacterHpBonuses } from './characterHitPoints'
import { collectCharacterPassiveEffects } from './characterPassiveEffects'
import { deriveEquippedArmor } from '../blocks/dnd/lib/equippedArmor'
import { abilitySpellGrantRows, syncAbilityGrantedSpells } from '../blocks/dnd/lib/abilitySpellGrants'
import { cloneModel, normalizeValue } from '../blocks/dnd/lib/itemSection'

const item = (data = {}) => ({ id: 95, typeId: 19, name: 'Палочка', data: { attunement: 'required', activation: 'equipped', ...data } })
const entry = (uid = 'first', state = {}) => ({ uid, item_id: 95, count: 1, params: { magic: { attuned: true, ...state }, note: 'keep' } })
const values = (equipped = [entry()], bag = []) => ({ lvl: { level: 7 }, DEX: { value: 12 }, items: { equipped, sections: [{ id: 'bag', name: 'Рюкзак', items: bag }] } })
const map = item => new Map([[String(item.id), item]])

describe('magic inventory mechanics', () => {
  it('requires equipment and attunement; carried items can work from the bag', () => {
    const magic = item({ derived_effects: [{ kind: 'save_bonus', value: 1 }] })
    expect(collectCharacterDerivedEffects(values(), map(magic))).toHaveLength(1)
    expect(collectCharacterDerivedEffects(values([entry('a', { attuned: false })]), map(magic))).toEqual([])
    expect(collectCharacterDerivedEffects(values([], [entry()]), map(magic))).toEqual([])
    magic.data.activation = 'carried'
    expect(collectCharacterDerivedEffects(values([], [entry()]), map(magic))).toHaveLength(1)
    magic.data.attunement = 'none'
    expect(collectCharacterDerivedEffects(values([entry('a', { attuned: false })]), map(magic))).toHaveLength(1)
    magic.data.level = 8
    expect(collectCharacterDerivedEffects(values(), map(magic))).toEqual([])
    magic.typeId = 2
    expect(collectCharacterDerivedEffects(values(), map(magic))).toEqual([])
  })

  it('hydrates inventory and spends one instance’s charges without changing quantity or another instance', () => {
    const state = values([entry(), entry('second')]), items = map(item({ max_use: 7, feature_actions: [{ key: 'cast', title: 'Огненный шар', uses_resource: true, resource_cost: 1 }] }))
    expect(resourceItemIds(state)).toContain('95')
    const resources = collectCharacterResources(state, items)
    expect(resources.map(r => r.value)).toEqual([7, 7])
    const actions = collectCharacterFeatureActions(state, items, resources)
    expect(actions.map(a => a.resource.key)).toEqual(resources.map(r => r.key))
    const patch = setCharacterResourceAvailable(state, items, resources[0].key, 3)
    expect(patch.items.equipped[0]).toMatchObject({ count: 1, params: { note: 'keep', magic: { remaining: 3, attuned: true } } })
    expect(collectCharacterResources({ ...state, ...patch }, items).map(r => r.value)).toEqual([3, 7])
    expect(patch.items.equipped[1]).toEqual(state.items.equipped[1])
    expect(cloneModel(normalizeValue(patch.items)).equipped[0].params.magic.remaining).toBe(3)
  })

  it('restores configured resources even while stored, but a dawn rule does not mean long rest', () => {
    const state = values([], [entry('stored', { remaining: 2 })]), dawn = item({ max_use: 7, recharge_note: 'На рассвете 1к6 + 1' })
    expect(restoreCharacterResources(state, map(dawn), 'long').patch).toEqual({})
    const rest = { ...dawn, data: { ...dawn.data, rollback_long_rest: true } }
    const { patch } = restoreCharacterResources(state, map(rest), 'long')
    expect(patch.items.sections[0].items[0]).toMatchObject({ count: 1, params: { magic: { remaining: 7 } } })
  })

  it('shares all ability collectors and keeps independent resources, choices and widgets per instance', () => {
    const magic = item({
      use_resources: [{ key: 'charges', title: 'Заряды', max_use: 3 }],
      sheet_widgets: [{ key: 'power', title: 'Мощь', kind: 'toggle', resource_key: 'charges' }],
      defenses: [{ kind: 'resistance', damage_type: 3 }],
      hp_bonuses: [{ base: 2, per_level: 1 }],
      passive_effects: [{ title: 'Памятка' }],
      weapon_damage: [{ key: 'fire', dice: 'd6', dice_count: 1 }],
      derived_effects: [{ kind: 'save_bonus', value: 1, choice_key: 'element', choice_values: ['fire'] }],
    })
    const state = values([entry('a', { choices: { element: ['fire'] } }), entry('b')]), items = map(magic)
    const resource = collectCharacterResources(state, items)[0]
    const spent = { ...state, ...setCharacterResourceAvailable(state, items, resource.key, 1) }
    expect(spent.items.equipped[0].params.magic.resource_counts).toEqual({ charges: 1 })
    expect(collectCharacterResources(spent, items).map(r => r.value)).toEqual([1, 3])
    const widgets = collectCharacterFeatureWidgets(spent, items, collectCharacterResources(spent, items))
    expect(widgets).toHaveLength(2)
    expect(widgets[0].key).not.toBe(widgets[1].key)
    const entries = featureEntries(spent, MAGIC_VALUE_ID, items).map(e => ({ ...e, widget_states: { power: e.uid === 'a' } }))
    const toggled = { ...spent, ...patchFeatureEntries(spent, MAGIC_VALUE_ID, entries) }
    expect(collectCharacterFeatureWidgets(toggled, items).map(w => w.active)).toEqual([true, false])
    expect(collectCharacterDefenses(toggled, items)).toHaveLength(2)
    expect(collectCharacterCombatEffects(toggled, items).weaponDamage).toHaveLength(2)
    expect(collectCharacterHpBonuses(toggled, items).map(b => b.value)).toEqual([9, 9])
    expect(collectCharacterPassiveEffects(toggled, items)).toHaveLength(2)
    expect(derivedNumericBonus(collectCharacterDerivedEffects(toggled, items), 'save_bonus', toggled).total).toBe(1)
  })

  it('does not mark another instance’s effect toggle active', () => {
    const magic = item({ status_effects: [{ key: 'light', effect: 15 }], sheet_widgets: [{ key: 'power', kind: 'toggle', status_effect_key: 'light' }] })
    const state = values([entry('a'), entry('b')]), source = ownedAbilityStatusSource(MAGIC_VALUE_ID, { id: 95, uid: 'a' }, magic)
    const link = magic.data.status_effects[0]
    state.states = toggleLinkedStatus(state, { id: 15, data: { stacking: 'multiple' } }, magic, link, source)
    expect(collectCharacterFeatureWidgets(state, map(magic)).map(w => w.active)).toEqual([true, false])
  })

  it('grants spells per active instance and removes them when stashed or unattuned', () => {
    const magic = item({ granted_spells: [{ spell: 924, slotless: true, cast_level: 3 }] })
    const state = values([entry('a'), entry('b')])
    const grants = syncAbilityGrantedSpells([], abilitySpellGrantRows([magic], state))
    expect(grants).toHaveLength(2)
    expect(new Set(grants.map(g => g.key)).size).toBe(2)
    state.items = updateMagicItemState(state.items, 'a', { attuned: false })
    const next = syncAbilityGrantedSpells(grants, abilitySpellGrantRows([magic], state))
    expect(next).toHaveLength(1)
    expect(next[0].source.entry_key).toBe('b')
    expect(syncAbilityGrantedSpells(next, abilitySpellGrantRows([magic], values([], [entry('b')])))).toEqual([])
  })

  it('honours the bracers no-armor/no-shield condition and accepts magical armor', () => {
    const magic = item({ derived_effects: [{ kind: 'armor_bonus', value: 2, requires_no_armor: true, allow_shield: false }] })
    const state = values(), items = map(magic)
    const rules = derivedArmorRules(collectCharacterDerivedEffects(state, items))
    expect(deriveEquippedArmor(state, items, () => [], rules).total).toBe(13)
    items.set('12', { id: 12, typeId: 19, data: { attunement: 'none', armor_base: { base_item_id: 4527, magic_bonus: 1 } } })
    items.set('4527', { id: 4527, typeId: 12, data: { armor: { shield: true, shield_bonus: 2 } } })
    state.items.equipped.push({ uid: 'shield', item_id: 12, count: 1 })
    expect(deriveEquippedArmor(state, items, () => [], rules).total).toBe(14)
  })
})
