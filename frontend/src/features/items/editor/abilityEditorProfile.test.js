import { describe, expect, it } from 'vitest'
import racial from '../../../../../resources/items/item_3_shema.json'
import classes from '../../../../../resources/items/item_4_shema.json'
import story from '../../../../../resources/items/item_18_shema.json'
import { abilityEditorProfile, activeAbilityBlocks, addAbilityBlock, removeAbilityBlock, changeAbilityResourceMode } from './abilityEditorProfile'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { visibleHandbookType } from '@/shared/lib/abilityTypes'
import { abilityUseTotal } from '@/shared/lib/dndAbilityUses'

const profile = abilityEditorProfile(story, 18)

describe('shared ability editor', () => {
  it('keeps all three schemas identical, including nested fields', () => {
    expect(racial).toEqual(classes)
    expect(story).toEqual(classes)
    function check(fields) {
      expect(new Set(fields.map(field => field.key)).size).toBe(fields.length)
      fields.forEach(field => { if (field.fields) check(field.fields) })
    }
    check(story)
  })

  it('places every mechanical field in exactly one block, with relevant origin bindings', () => {
    const bindings = ['race_ids', 'subrace_ids', 'class_ids', 'subclass_ids']
    const keys = [...profile.primary, ...profile.blocks.flatMap(block => block.fields)].map(field => field.key)
    expect(keys.sort()).toEqual(story.map(field => field.key).filter(key => !bindings.includes(key)).sort())
    expect(new Set(keys).size).toBe(keys.length)
    expect(abilityEditorProfile(racial, 3).primary.map(field => field.key)).toContain('race_ids')
    expect(abilityEditorProfile(classes, 4).primary.map(field => field.key)).toContain('class_ids')
  })

  it('keeps simple descriptions compact even with old resource defaults and empty containers', () => {
    expect(activeAbilityBlocks(profile.blocks, { desc: 'Дар', level: 1, max_use_min: 1, max_use_stat_multiplier: 1, max_use_bonus: 0, granted_spells: [], prereq: { min_stats: [] } })).toEqual([])
    expect(activeAbilityBlocks(profile.blocks, { max_use: 0, status_effects: [{ effect: 42 }] })).toEqual(['resources', 'status_effects'])
  })

  it('adds and removes a block without losing unrelated nested data or restoring removed rules on save', () => {
    const data = { desc: 'Дар', custom_metadata: { preserve: true }, status_effects: [{ effect: 42, duration: { kind: 'rounds', value: 2 } }] }
    const grant = profile.blocks.find(block => block.key === 'granted_spells')
    addAbilityBlock(grant, data)
    data.granted_spells[0].spell = '321'
    expect(normalizeDataForSave(data, story).granted_spells[0].spell).toBe(321)
    removeAbilityBlock(grant, data)
    const saved = normalizeDataForSave(data, story)
    expect(saved.granted_spells).toEqual([])
    expect(saved.status_effects).toMatchObject([{ effect: 42, duration: { kind: 'rounds', value: 2 } }])
    expect(saved.custom_metadata).toEqual({ preserve: true })
  })

  it('does not create an empty independent resource when adding the resource block', () => {
    const data = {}
    addAbilityBlock(profile.blocks.find(block => block.key === 'resources'), data)
    expect(data.use_resources).toBeUndefined()
    expect(data.max_use_stat_multiplier).toBe(1)
  })

  it('switches resource calculations without retaining an overriding former mode', () => {
    const data = { max_use_stat: 3, max_use: 2, max_use_scaling: true, manual_size: true }
    changeAbilityResourceMode(data, 'level')
    expect(abilityUseTotal(data, { lvl: { level: 6 } })).toBe(6)
    changeAbilityResourceMode(data, 'fixed')
    expect(abilityUseTotal(data, { lvl: { level: 6 } })).toBe(2)
  })

  it('only exposes the story catalogue in navigation when it has visible entries', () => {
    expect(visibleHandbookType({ id: 18, countItems: 0 })).toBe(false)
    expect(visibleHandbookType({ id: 18, countItems: 1 })).toBe(true)
    expect(visibleHandbookType({ id: 3, countItems: 0 })).toBe(true)
  })
})
