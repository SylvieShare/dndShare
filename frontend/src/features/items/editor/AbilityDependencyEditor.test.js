import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import AbilityEditor from './AbilityEditor.vue'
import { choiceFilterFields } from './choiceFilterFields'
import { changeDerivedKind, dependencyFields } from './abilityDependencyManifest'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import schema from '../../../../../resources/items/item_4_shema.json'
vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { render: () => h('textarea') } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn().mockResolvedValue({ references: [], items: [], types: [] }) }))
async function render(data) {
  const app = createSSRApp({ render: () => h(AbilityEditor, { data, typeId: 4, fields: schema.filter(f => Object.keys(data).includes(f.key)) }) })
  app.use(createPinia())
  app.provide(itemFieldEditorKey, { itemData: data, getSuggests: () => [], getSuggestId: f => f.suggest_id, itemRefLabel: id => `Предмет ${id}` })
  return renderToString(app)
}
describe('dependency authoring', () => {
  it('offers nested class references as named filters without exposing JSON paths to the author', () => {
    expect(choiceFilterFields([{ key: 'classes', name: 'Классы', type: 'object_array', fields: [{ key: 'id', name: 'Класс', type: 'item', item_type: 9 }] }])).toEqual([{ key: 'id', name: 'Классы · Класс', type: 'item', item_type: 9, path: 'classes.id' }])
  })
  it('shows only speed parameters and preserves the existing armor condition on open', async () => {
    const data = { derived_effects: [{ kind: 'speed_bonus', value: 10, forbid_heavy_armor: true }] }
    const before = structuredClone(data)
    const html = await render(data)
    expect(html).toContain('aria-label="Величина"')
    expect(html).not.toContain('aria-label="Основа КД"')
    expect(html).not.toContain('aria-label="Владение"')
    expect(html).toContain('aria-label="Не в тяжёлом доспехе"')
    expect(data).toEqual(before)
  })
  it('removes incompatible calculations when the author changes the result kind', () => {
    const data = { kind: 'armor_formula', base: 10, ability_ids: [2, 3], allow_shield: false, value: 5, skill_ids: [1], choice_key: 'style' }
    changeDerivedKind(data, 'speed_bonus')
    expect(data).toEqual({ kind: 'speed_bonus', allow_shield: false, value: 5, choice_key: 'style' })
  })
  it('keeps proficiency selectors numeric and exposes critical dice in the main form', async () => {
    const fields = dependencyFields('roll_adjustments', schema.find(f => f.key === 'roll_adjustments').fields, ['minimum_proficiency_rank'])
    expect(fields[0].numeric).toBe(true)
    const html = await render({ critical_damage: [{ extra_weapon_dice: 1, weapon_kind: 'melee' }] })
    expect(html).toContain('aria-label="Дополнительных костей оружия"')
    expect(html).not.toContain('Дополнительные настройки')
  })
  it('uses the same resource modes for independent resources, hiding irrelevant formulas', async () => {
    const html = await render({ use_resources: [{ key: 'darkness', title: 'Тьма', max_use: 1, rollback_long_rest: true }] })
    expect(html).toContain('aria-label="Как считать использования"')
    expect(html).toContain('Тьма')
    expect(html).not.toContain('aria-label="Характеристика"')
    expect(html).not.toContain('aria-label="Множитель модификатора"')
  })
  it('offers the existing combined choice mode without asking for numeric source IDs', async () => {
    const html = await render({ choices: [{ key: 'expertise', count: 2, source: 'suggest_union', suggest_sources: [{ suggest_id: 15, prefix: 'skill', label: 'Навык' }] }] })
    expect(html).toContain('Несколько словарей вместе')
    expect(html).not.toContain('ID словаря')
    expect(html).not.toContain('aria-label="Характеристика заклинаний"')
    expect(html).toContain('Только уже освоенные владения')
  })
  it('normalizes saved object references without dropping granted spells or unknown settings', () => {
    const data = { granted_spells: [{ spell: { id: 511 }, ability: 6, slotless: true }], derived_effects: [{ kind: 'tool_proficiency', choice_value_prefix: 'tool', target_ids: [7] }] }
    const result = normalizeDataForSave(data, schema)
    expect(result.granted_spells[0]).toEqual({ spell: 511, ability: 6, slotless: true })
    expect(result.derived_effects).toEqual(data.derived_effects)
  })
  it('hides spell overrides until enabled and labels textual reminders as non-automatic', async () => {
    const html = await render({ granted_spells: [{ spell: 511 }], passive_effects: [{ title: 'Памятка' }] })
    expect(html).not.toContain('aria-label="Уровень сотворения"')
    expect(html).toContain('Сотворять на другом уровне')
    expect(html).toContain('Автоматические изменения задаются отдельными зависимостями')
  })
})
