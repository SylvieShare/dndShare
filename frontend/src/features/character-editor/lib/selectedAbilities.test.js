import { describe, expect, it } from 'vitest'
import { abilitySelectionCount, abilitySelectionState, applyAbilitySelection, selectedAbilityEligibility } from './selectedAbilities'
import { featuresForBinding } from '../settings/dnd/creation/progression'
import { collectCharacterResources } from './characterResources'
import { collectCharacterDerivedEffects } from './characterDerivedEffects'
import { abilitySpellGrantRows, syncAbilityGrantedSpells } from '../blocks/dnd/lib/abilitySpellGrants'
import { classProgression } from '@/features/items/lib/classProgression'
import { readFileSync } from 'node:fs'
const manifest = ['initial', 'middle', 'advanced'].flatMap(name => JSON.parse(readFileSync(new URL(`../../../../../scripts/catalogue/warlock-invocations/${name}.json`, import.meta.url))))
const parent = { id: 4069, name: 'Таинственные воззвания', data: { class_ids: [{ id: 4018 }], level: 2,
  ability_selection: { replace_count: 1, counts: [{ level: 2, count: 2 }, { level: 5, count: 3 }, { level: 7, count: 4 }, { level: 9, count: 5 }, { level: 12, count: 6 }, { level: 15, count: 7 }, { level: 18, count: 8 }] },
} }
const items = [parent, ...manifest.map((item, i) => ({ ...item, id: 9000 + i, typeId: 4 }))]
const find = name => items.find(item => item.nameEn === name)
const values = (level, entries = []) => ({ lvl: { level }, classes: [{ id: 4018, level }], abilities_class: [{ id: 4069 }, ...entries],
  spells: { tabs: [{ key: 'class:4018', class_item_id: 4018, spells: [{ id: 500 }] }], grants: [] }, CHA: { value: 16 } })

describe('selected class abilities', () => {
  it('keeps all 32 invocation options out of automatic acquisition and exposes selection gains in progression', () => {
    expect(manifest).toHaveLength(32)
    expect(featuresForBinding(items, { classId: 4018 }, 20)).toEqual([parent])
    const roadmap = classProgression({ id: 4018, data: {} }, null, items)
    expect(roadmap[1].choices).toContainEqual(expect.objectContaining({ count: 2, text: 'Таинственные воззвания: выбрать новые' }))
    expect(roadmap[4].choices).toContainEqual(expect.objectContaining({ count: 1, text: 'Таинственные воззвания: выбрать новые' }))
    expect(roadmap[2].choices).toContainEqual(expect.objectContaining({ count: 1, text: 'Таинственные воззвания: замена по желанию' }))
    expect([1,2,5,7,9,12,15,18].map(level => abilitySelectionCount(parent, level))).toEqual([0,2,3,4,5,6,7,8])
  })
  it('checks class level, the required cantrip and the pact choice including multiclass characters', () => {
    const mixed = { ...values(12), classes: [{ id: 4018, level: 2 }, { id: 9, level: 10 }] }
    expect(selectedAbilityEligibility(find('Ascendant Step'), parent, mixed).eligible).toBe(false)
    expect(selectedAbilityEligibility(find('Agonizing Blast'), parent, { ...mixed, spells: {} }).eligible).toBe(false)
    expect(selectedAbilityEligibility(find('Thirsting Blade'), parent, values(5)).eligible).toBe(false)
    expect(selectedAbilityEligibility(find('Thirsting Blade'), parent, values(5, [{ id: 4070, choices: { choice: ['Клинок пакта'] } }])).eligible).toBe(true)
  })
  it('allows catch-up and one replacement, rejects duplicates, a wrong parent, or two replacements', () => {
    const a = { id: find('Armor of Shadows').id }, b = { id: find('Devil’s Sight').id }
    const c = { id: find('Eldritch Sight').id }, d = { id: find('Eldritch Spear').id }
    expect(abilitySelectionState(parent, values(2), items, [a,b], [], 0).ready).toBe(true)
    expect(abilitySelectionState(parent, values(3), items, [a,c], [a,b], 1).ready).toBe(true)
    expect(abilitySelectionState(parent, values(3), items, [c,d], [a,b], 1).ready).toBe(false)
    expect(abilitySelectionState(parent, values(3), items, [a,a], [a,b], 1).ready).toBe(false)
    expect(abilitySelectionState(parent, values(3), items, [a,{ id: parent.id }], [a,b], 1).ready).toBe(false)
    expect(abilitySelectionState(parent, values(3), items, [a,c], [a,b], 0).ready).toBe(false)
  })
  it('preserves kept charges, removes replaced grants and statuses, and adds only the selected mechanics', () => {
    const armor = find('Armor of Shadows'), thief = find('Thief of Five Fates'), influence = find('Beguiling Influence')
    let before = values(3, [{ id: armor.id, uid: 'armor' }, { id: thief.id, uid: 'thief', count: 0 }])
    before.states = [{ source: { kind: 'ability', item_id: armor.id } }, { source: { kind: 'manual' } }]
    const after = applyAbilitySelection(before, parent, [{ id: influence.id }, { id: thief.id }], items)
    expect(after.abilities_class.find(entry => entry.id === thief.id)).toMatchObject({ uid: 'thief', count: 0 })
    expect(after.states).toEqual([{ source: { kind: 'manual' } }])
    const map = new Map(items.map(item => [String(item.id), item]))
    expect(collectCharacterResources(after, map)).toEqual([expect.objectContaining({ value: 0, total: 1 })])
    expect(collectCharacterDerivedEffects(after, map)).toContainEqual(expect.objectContaining({ kind: 'skill_proficiency', skill_ids: [15,16] }))
    const beforeGrants = syncAbilityGrantedSpells([], abilitySpellGrantRows([armor], before))
    expect(beforeGrants).toHaveLength(1)
    expect(syncAbilityGrantedSpells(beforeGrants, abilitySpellGrantRows([influence, thief], after))).toEqual([])
  })
})
