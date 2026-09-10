import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import CatalogueEditor from './CatalogueEditor.vue'
import AbilityEditor from '../AbilityEditor.vue'
import { catalogueProfile, catalogueProfiles } from './catalogueProfiles'
import { catalogueFieldVisible, updateCatalogueValue } from './catalogueFields'
import { catalogueValidation } from './catalogueValidation'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { useSpellCalc } from '@/features/character-editor/blocks/dnd/composables/useSpellCalc'
import { ref } from 'vue'
vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { render: () => h('textarea') } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn().mockResolvedValue({ references: [], items: [], types: [] }) }))
const modules = import.meta.glob('../../../../../../resources/items/*shema.json', { eager: true, import: 'default' })
const schema = id => Object.entries(modules).find(([path]) => path.endsWith(`/item_${id}_shema.json`))[1]
async function form(typeId, data = {}) {
  const before = structuredClone(data)
  const app = createSSRApp({ render: () => h(typeId === 7 ? AbilityEditor : CatalogueEditor, { fields: schema(typeId), data, typeId, zIndex: 4500 }) })
  app.use(createPinia())
  app.provide(itemFieldEditorKey, { itemData: data, itemName: 'Запись', zIndex: 4500, getSuggests: () => [], getSuggestLabel: (_, id) => `Владение ${id}`, getSuggestId: f => f.suggest_id ?? f.suggest_type_id, itemRefLabel: id => `Предмет ${id}`, ensureItemNames: () => Promise.resolve() })
  const html = await renderToString(app)
  if (typeId === 15 && before.code === undefined) expect(data).toEqual({ ...before, code: 'zapis' })
  else expect(data).toEqual(before)
  expect(html).not.toContain('[object Object]')
  return html
}
describe('catalogue authoring', () => {
  it.each(Object.keys(catalogueProfiles).map(Number))('places all fields of type %i exactly once and renders a blank form', async id => {
    const fields = schema(id), profile = catalogueProfile(id, fields)
    const keys = [...profile.primary, ...profile.groups.flatMap(g => g.fields)].map(f => f.key)
    expect(keys.sort()).toEqual(fields.filter(f => !f.readonly).map(f => f.key).sort())
    expect(new Set(keys).size).toBe(keys.length)
    const html = await form(id)
    expect(html).toContain('ability-editor-main')
    expect(html).toContain('ability-editor-mechanics')
  })
  it('keeps gear compact and accepts fractional weights', async () => {
    const html = await form(2, { desc: 'Верёвка', weight: 0.5 })
    expect(html).not.toContain('aria-label="Основа КД"')
    expect(html).not.toContain('aria-label="Содержимое набора"')
    expect(catalogueValidation(schema(2), { weight: 0.5 }, 2)).toEqual([])
    expect(catalogueValidation(schema(2), { weight: -1 }, 2)).not.toEqual([])
  })
  it('shows thrown-weapon range and keeps two-handed dice behind the versatile property', async () => {
    const html = await form(1, { tags: [11], range_min: 20, range_max: 60, attacks: [{ count: 1, dice_id: 'd4', type: 1 }] })
    expect(html).toContain('Обычная дистанция, фт.')
    expect(html).not.toContain('Урон двумя руками')
    expect(catalogueValidation(schema(1), { range_min: 60, range_max: 20 }, 1)).toContain('Предельная дистанция не может быть меньше обычной.')
  })
  it('edits actual spell damage, saving throws and growth without showing inactive healing', async () => {
    const html = await form(5, { lvl: 1, damage: { save_ability: 'dex', save_effect: 'half', scaling: 'slot', dices: [{ count: 3, dice_id: 'd6', type: 4 }], addon: [{ count: 1, dice_id: 'd6', type: 4 }] } })
    expect(html).toContain('При успешном спасброске')
    expect(html).toContain('Дополнительный урон за шаг роста')
    expect(html).not.toContain('Восстановление хитов')
    const calc = useSpellCalc({ diceDetailsMap: ref({ d6: { value: 'к6', sides: 6 } }), diceMap: ref({}), damageTypeMap: ref({}), schoolMap: ref({}) })
    const saved = normalizeDataForSave({ lvl: 1, damage: { scaling: 'slot', dices: [{ count: 3, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] } }, schema(5))
    expect(calc.damageDiceParts({ data: saved }, 3, 5)[0].count).toBe(5)
  })
  it('changes shield and armor rules without hidden fields affecting the result', async () => {
    const next = updateCatalogueValue({ ac: 12, use_dex: true, dex_cap: 2, custom: 'kept' }, { key: 'shield' }, true, 'armor.shield')
    expect(next).toEqual({ shield: true, custom: 'kept' })
    const shield = updateCatalogueValue({ category: 'medium', armor: { ac: 14, use_dex: true, dex_cap: 2 } }, { key: 'category' }, 'shield', 'category', 12)
    expect(shield.armor).toEqual({ shield: true, shield_bonus: 2 })
    expect(updateCatalogueValue(shield, { key: 'category' }, 'heavy', 'category', 12).armor).toEqual({ shield: false, use_dex: false })
    const html = await form(12, { category: 'shield', armor: { shield: true, shield_bonus: 2 } })
    expect(html).toContain('Прибавка к КД')
    expect(html).not.toContain('Основа КД')
    expect(html).not.toContain('Предел бонуса Ловкости')
  })
  it('edits bestiary text blocks as rich content and movement as rows', async () => {
    const html = await form(6, { combat: { speed_opt: [{ name: 'Полёт', value: 60 }] }, actions: [{ name: 'Укус', value: '<p>1к6</p>' }] })
    expect(html).toContain('Скорость, фт.')
    expect(html).toContain('Удалить: Укус')
    expect(html).toContain('Описание и правила')
  })
  it('uses item selections for backgrounds and retains canonical arrays on save', async () => {
    const data = { item_choices: [{ key: 'tool', label: 'Инструмент', option_item_ids: [393, 394], grants_tool_proficiency: true, replace_tool_prof_id: 27 }] }
    const html = await form(11, data)
    expect(html).toContain('Варианты снаряжения')
    expect(html).not.toContain('ID вариантов')
    expect(html).not.toContain('Заменяемое владение (ID)')
    const saved = normalizeDataForSave({ equipment_items: [{ item_id: { id: 42 }, count: 2 }], item_choices: [{ option_item_ids: ['393', 394] }] }, schema(11))
    expect(saved.equipment_items[0].item_id).toBe(42)
    expect(saved.item_choices[0].option_item_ids).toEqual([393, 394])
  })
  it('keeps non-magical classes free of spell settings and preserves class-specific spell progression', async () => {
    const html = await form(9, { hit_die: 'd12', asi_levels: '4,8,12,16,19' })
    expect(html).not.toContain('Заклинаний при получении')
    const saved = normalizeDataForSave({ caster_progression: 'third', spellcasting: { start_level: 3, ability: 4, list_class: 4014, known_progression: [{ level: 3, spells: 3 }, { level: 7, spells: 5 }] } }, schema(17))
    expect(spellcastingRulesAt({ data: saved }, 2)).toBeNull()
    expect(spellcastingRulesAt({ data: saved }, 7).spellsKnown).toBe(5)
  })
  it('retains race variants and hides vehicle durability for mounts', async () => {
    const html = await form(8, { variants: [{ label: 'Одарённый', value: 'gifted', asi_choice: { count: 2, bonus: 1 }, feat_choice: { count: 1 } }] })
    expect(html).toContain('Одарённый')
    expect(html).toContain('Сколько характеристик')
    expect(catalogueFieldVisible({ key: 'vehicle_stats' }, {}, 13, 'vehicle_stats', { category: 'mount' })).toBe(false)
  })
  it('uses the ability dependency editor for feats including spellcasting prerequisites', async () => {
    const html = await form(7, { description: 'Черта', prereq: { spellcasting: true, min_level: 4 }, derived_effects: [{ kind: 'armor_bonus', value: 1 }] })
    expect(html).toContain('Описание черты')
    expect(html).toContain('Требуется заклинательство')
    expect(html).toContain('Минимальный уровень')
    expect(html).toContain('Что изменить')
  })
  it('hides duration quantities for permanent effects and never adds a character-level gate', async () => {
    const html = await form(15, { code: 'ward', duration: { kind: 'permanent' }, derived_effects: [{ kind: 'armor_bonus', value: 2 }] })
    expect(html).not.toContain('aria-label="Длительность"')
    expect(html).not.toContain('Доступно с уровня')
    expect(updateCatalogueValue({ kind: 'minutes', value: 3 }, { key: 'kind' }, 'manual', 'duration.kind')).toEqual({ kind: 'manual' })
  })
})
