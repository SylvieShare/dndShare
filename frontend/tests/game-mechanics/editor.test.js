import { describe, expect, it } from 'vitest'
import suites from '../../../scripts/mechanics/suites.json'
import { abilityEditorProfile } from '@/features/items/editor/abilityEditorProfile'
import { dependencyManifest, dependencyFields, changeDerivedKind } from '@/features/items/editor/abilityDependencyManifest'
import effects from '../../../resources/items/item_15_shema.json'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'

const schemas = import.meta.glob('../../../resources/items/item_*_shema.json', { eager: true, import: 'default' })
const core = [3, 4, 7, 18, 19]
describe('authoring a sheet dependency', () => {
  it('requires both client suites for every ability, feat and magic-item editor block', () => {
    const covered = new Set(suites.filter(s => s.web.length && s.android.length).flatMap(s => s.rules))
    const missing = new Set()
    for (const type of core) {
      const schema = schemas[`../../../resources/items/item_${type}_shema.json`]
      for (const { key } of abilityEditorProfile(schema, type).blocks) if (!covered.has(key)) missing.add(key)
    }
    expect([...missing]).toEqual([])
  })

  it('can create, save, reopen and change the scope and weapon restrictions of an effect', () => {
    const schema = effects.find(field => field.key === 'derived_effects')
    const model = { kind: 'roll_mode', mode: 'advantage', scopes: ['attack'], forbid_improvised: true, weapon_attacks_only: true }
    const gates = dependencyManifest.derived_effects.gates.filter(g => !g.when || g.when(model))
    const keys = [...dependencyManifest.derived_effects.main(model), ...gates.flatMap(g => g.keys)]
    const available = dependencyFields('derived_effects', schema.fields, keys, model).map(f => f.key)
    for (const field of Object.keys(model)) expect(available).toContain(field)
    const reopened = normalizeDataForSave({ derived_effects: [model] }, [schema]).derived_effects[0]
    expect(reopened).toMatchObject(model)
    changeDerivedKind(reopened, 'armor_minimum')
    expect(reopened.weapon_attacks_only).toBeUndefined()
    expect(reopened.forbid_improvised).toBeUndefined()
    expect(reopened.scopes).toBeUndefined()
  })
})
