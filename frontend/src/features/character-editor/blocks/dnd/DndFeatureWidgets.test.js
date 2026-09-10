import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import DndFeatureWidgets from './DndFeatureWidgets.vue'
import { collectCharacterFeatureWidgets, featureWidgetResourceKeys } from '@/features/character-editor/lib/characterFeatureWidgets'
import { collectCharacterResources, restoreCharacterResources, setCharacterResourceAvailable } from '@/features/character-editor/lib/characterResources'

function fixture(unlimited = false) {
  const values = { lvl: { level: unlimited ? 20 : 3 }, abilities_class: [{ id: 10, uid: 'rage', count: 2 }] }
  const items = new Map([['10', { id: 10, name: 'Ярость', data: {
    max_use: unlimited ? 0 : 3, rollback_long_rest: true,
    scaling: [{ level: 1, value: '+2', uses: unlimited ? 0 : 3 }],
    sheet_widgets: [{ key: 'rage', kind: 'toggle', value_source: 'scaling' }],
  } }]])
  return { values, items }
}
async function render({ values, items }, ownerMode = true) {
  const app = createSSRApp({ render: () => h(DndFeatureWidgets) })
  app.provide('charCtx', { ownerMode, values, characterResources: { itemsById: items, resources: collectCharacterResources(values, items) } })
  return renderToString(app)
}
describe('resource controls in feature widgets', () => {
  it('renders available and spent resource pips with rest rules instead of a fraction', async () => {
    const html = await render(fixture())
    expect(html.match(/role="button"/g)).toHaveLength(3)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
    expect(html).toContain('Восстанавливается на длинном отдыхе')
    expect(html).not.toContain('<small>Доступно</small>')
    expect(html).not.toContain('2/3')
  })
  it('keeps visitor resource markers read-only and handles unlimited rage without pips', async () => {
    const readonly = await render(fixture(), false)
    expect(readonly).not.toContain('role="button"')
    expect(readonly).toContain('role="img"')
    const unlimited = await render(fixture(true))
    expect(unlimited).toContain('Без ограничений')
    expect(unlimited).not.toContain('role="button"')
    expect(unlimited).not.toContain('∞/∞')
  })
  it('uses the original ability count and restoration, hiding only resources of visible widgets', () => {
    const { values, items } = fixture()
    let resources = collectCharacterResources(values, items)
    const widget = collectCharacterFeatureWidgets(values, items, resources)[0]
    expect(featureWidgetResourceKeys(values, items, resources).has(widget.resource.key)).toBe(true)
    const spent = { ...values, ...setCharacterResourceAvailable(values, items, widget.resource.key, 1) }
    expect(spent.abilities_class[0].count).toBe(1)
    expect(collectCharacterFeatureWidgets(spent, items, collectCharacterResources(spent, items))[0].resource.value).toBe(1)
    const restored = { ...spent, ...restoreCharacterResources(spent, items, 'long').patch }
    expect(collectCharacterFeatureWidgets(restored, items, collectCharacterResources(restored, items))[0].resource.value).toBe(3)
    items.get('10').data.sheet_widgets[0].level = 5
    resources = collectCharacterResources(values, items)
    expect(resources).toHaveLength(1)
    expect(featureWidgetResourceKeys(values, items, resources).size).toBe(0)
  })
})
