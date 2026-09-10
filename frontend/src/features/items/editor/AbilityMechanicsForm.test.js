import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import AbilityEditor from './AbilityEditor.vue'
import DamageRollOptions from '@/features/character-editor/blocks/dnd/components/DamageRollOptions.vue'
import schema from '../../../../../resources/items/item_4_shema.json'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { render: () => h('textarea') } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn().mockResolvedValue({ references: [], items: [], types: [] }), fetchPut: vi.fn(), fetchPost: vi.fn(), fetchDelete: vi.fn() }))

async function form(data) {
  const app = createSSRApp({ render: () => h(AbilityEditor, { fields: schema.filter(field => Object.keys(data).includes(field.key)), data, typeId: 4 }) })
  app.use(createPinia())
  app.provide(itemFieldEditorKey, { itemData: data, itemName: 'Способность', zIndex: 4500, getSuggests: () => [], getSuggestId: field => field.suggest_id, itemRefLabel: id => `Эффект ${id}` })
  return renderToString(app)
}

describe('ability mechanic composition', () => {
  it('renders one progression table, not a dependency per level, and derives labels by default', async () => {
    const html = await form({ scaling: [{ level: 1, value: '+2', uses: 2 }, { level: 9, value: '+3', uses: 4 }] })
    expect(html.match(/class="[^"]*\bability-dependency(?=[\s"])[^"]*"/g)).toHaveLength(1)
    expect(html).toContain('<table>')
    expect(html).not.toContain('Шаг прогрессии')
    expect(html).not.toContain('aria-label="Подпись 1"')
  })
  it('shows the level formula and preview without unused fixed count or menu captions', async () => {
    const html = await form({ weapon_damage: [{ label: 'Скрытая атака', dice: 'd6', dice_count_level_divisor: 2, dice_count_rounding: 'up' }] })
    expect(html).toContain('Одна кость на каждые N уровней')
    expect(html).toContain('10к6')
    expect(html).not.toContain('aria-label="Количество костей"')
    expect(html).not.toContain('Пункт меню для крита')
    expect(html).not.toContain('aria-label="Доступно с уровня"')
  })
  it('keeps metric panels free of toggle-specific controls and fixed values when calculated', async () => {
    const html = await form({ sheet_widgets: [{ title: 'Урон', kind: 'metric', value_source: 'weapon_damage' }] })
    expect(html).not.toContain('Какой эффект включать')
    expect(html).not.toContain('aria-label="Постоянное значение"')
    expect(html).not.toContain('Свои подписи переключателя')
  })
  it('offers independent choices and a single roll without enumerating their combinations', async () => {
    const app = createSSRApp({ render: () => h(DamageRollOptions, { versatile: true, actions: [{ key: 'sneak', label: 'Скрытая атака', dice: 'd6', dice_count: 3 }] }) })
    const html = await renderToString(app)
    expect(html).toContain('Критическое попадание')
    expect(html).toContain('Двумя руками')
    expect(html).toContain('Скрытая атака')
    expect(html).toContain('aria-label="Добавит +3к6"')
    expect(html.match(/Бросить урон/g)).toHaveLength(1)
    expect(html.match(/role="switch"/g)).toHaveLength(3)
  })
})
