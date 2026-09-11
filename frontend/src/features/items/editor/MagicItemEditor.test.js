import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import AbilityEditor from './AbilityEditor.vue'
import { abilityEditorProfile } from './abilityEditorProfile'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import schema from '../../../../../resources/items/item_19_shema.json'
import abilities from '../../../../../resources/items/item_4_shema.json'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { render: () => h('textarea') } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn().mockResolvedValue({ references: [], items: [], types: [] }) }))

async function form(data) {
  const app = createSSRApp({ render: () => h(AbilityEditor, { fields: schema, data, typeId: 19 }) })
  app.use(createPinia())
  app.provide(itemFieldEditorKey, { itemData: data, itemName: 'Палочка', zIndex: 4500, getSuggests: () => [], getSuggestLabel: () => '', getSuggestId: f => f.suggest_id ?? f.suggest_type_id, itemRefLabel: id => `Предмет ${id}`, ensureItemNames: () => Promise.resolve() })
  return renderToString(app)
}

describe('magic item editor', () => {
  it('reuses the exact dependency schema and puts every property in one column', () => {
    const profile = abilityEditorProfile(schema, 19)
    const placed = [...profile.primary, ...profile.blocks.flatMap(b => b.fields)]
    expect(placed.map(f => f.key).sort()).toEqual(schema.map(f => f.key).sort())
    for (const field of abilities.filter(f => !['desc', 'race_ids', 'subrace_ids', 'class_ids', 'subclass_ids'].includes(f.key))) {
      const actual = structuredClone(schema.find(f => f.key === field.key))
      // Instance activation and named stock initialization are magic-item extensions.
      if (['use_resources', 'derived_effects', 'roll_triggers'].includes(field.key)) {
        actual.fields = actual.fields.filter(f => !['activation', 'initial_charges', 'use_key'].includes(f.key))
        if (field.key === 'roll_triggers') actual.fields.find(f => f.key === 'event').options = actual.fields.find(f => f.key === 'event').options.filter(o => o.value !== 'any')
      }
      expect(actual).toEqual(field)
    }
    expect(profile.blocks.some(b => ['armor', 'cost', 'attunement'].includes(b.key))).toBe(false)
  })

  it('keeps empty mechanics compact and hides inapplicable attunement requirements', async () => {
    const data = { attunement: 'none', activation: 'equipped' }
    const html = await form(data)
    expect(html).toContain('Магический предмет')
    expect(html).toContain('Добавить зависимость')
    expect(html).not.toContain('Кто может настроиться')
    expect(html).not.toContain('Расовые способности')
    expect(html.match(/class="[^"]*\bability-dependency(?=[\s"])[^"]*"/g)).toBeNull()
    expect(data).toEqual({ attunement: 'none', activation: 'equipped' })
  })

  it('renders resources and each action as its own card without losing gear on save', async () => {
    const data = { desc: '<p>Палочка</p>', cost: { value: 25, suggest_id: 1 }, weight: 0.25, attunement: 'required', attunement_requirement: 'Заклинатель', activation: 'equipped', max_use: 7, feature_actions: [{ key: 'one', title: 'Первое' }, { key: 'two', title: 'Второе' }] }
    const html = await form(data)
    expect(html).toContain('Кто может настроиться')
    expect(html).toContain('Заряды и восстановление')
    expect(html.match(/class="[^"]*\bability-dependency(?=[\s"])[^"]*"/g)).toHaveLength(3)
    expect(normalizeDataForSave(data, schema)).toMatchObject({ cost: { value: 25, suggest_id: 1 }, weight: 0.25, max_use: 7, feature_actions: [{ key: 'one' }, { key: 'two' }] })
  })
})
