import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { useSuggestStore } from '@/stores/suggest'
import MagicItemDetailSummary from './MagicItemDetailSummary.vue'
import MagicItemDetailContent from './MagicItemDetailContent.vue'
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn().mockResolvedValue({ items: [] }) } }))
const item = { id: 178, typeId: 19, name: 'Магическое оружие', data: { desc: '<p>Магическое описание</p>', weapon: { base_item_id: 58, magic_bonus: 1 }, treasure: { weight: 10 } } }
const instance = { item_id: 58, magic_item_id: 178 }
async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) }), pinia = createPinia()
  useSuggestStore(pinia).set(17, [])
  app.use(pinia)
  return renderToString(app)
}
it('places the selected foundation in the cover and retains the magic summary', async () => {
  const baseItem = { id: 58, typeId: 1, name: 'Трезубец', iconImageUrl: '/trident.png', data: { attacks: [{ count: 1, dice_id: 'd6' }] } }
  const html = await render(MagicItemDetailSummary, { item, instance, baseItem })
  expect(html).toContain('Основа оружия')
  expect(html).toContain('Магический бонус')
  expect(html).toContain('magic-bases-grid--single')
  expect(html).toContain('aria-label="Трезубец"')
  expect(html).toContain('role="button"')
  expect(html).toContain('/trident.png')
  expect(html.indexOf('Основа оружия')).toBeGreaterThan(html.indexOf('cover-summary-bottom'))
  expect(await render(MagicItemDetailSummary, { item })).not.toContain('Основа оружия')
})
it('hides catalogue-only sections for a chosen instance and retains magic additions', async () => {
  const html = await render(MagicItemDetailContent, { item, instance, type: { fields: [] } })
  for (const text of ['Подходящее оружие', 'Генератор сокровищ', 'Характеристики оружия']) expect(html).not.toContain(text)
  expect(html).toContain('Магическое описание')
  expect(html).toContain('Что добавляется к оружию')
  const catalogue = await render(MagicItemDetailContent, { item, type: { fields: [] } })
  expect(catalogue).toContain('Подходящее оружие')
  expect(catalogue).toContain('Генератор сокровищ')
})
it('uses the same instance mode for armor', async () => {
  const armor = { ...item, data: { desc: 'Доспех', armor_base: { base_item_id: 12 }, treasure: { weight: 10 } } }
  const html = await render(MagicItemDetailContent, { item: armor, instance: { item_id: 178 }, type: { fields: [] } })
  expect(html).not.toContain('Подходящие доспехи')
  expect(html).not.toContain('Генератор сокровищ')
})
