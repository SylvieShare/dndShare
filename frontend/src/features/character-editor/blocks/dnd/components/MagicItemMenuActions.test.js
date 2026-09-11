import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { expect, it } from 'vitest'
import MagicItemMenuActions from './MagicItemMenuActions.vue'
const item = { id: 178, typeId: 19, data: { attunement: 'required', weapon: { base_item_id: 58 } } }
const entry = { uid: 'a', item_id: 58, magic_item_id: 178, params: { magic: { attuned: true } } }
const render = (source = item, row = entry) => renderToString(createSSRApp({ render: () => h(MagicItemMenuActions, { item: source, entry: row, values: { weapon: [row] } }) }))
it('offers attunement directly and hides unnecessary configuration for a fixed weapon', async () => {
  const html = await render()
  expect(html).toContain('Снять настройку')
  for (const label of ['Магические свойства', 'Изменить основу', 'Выбрать основу', 'Параметры экземпляра']) expect(html).not.toContain(label)
  expect(await render(item, { ...entry, params: {} })).toContain('Настроить на персонажа')
})
it('shows configuration only when authored options need it and hides unneeded attunement', async () => {
  const html = await render({ ...item, data: { ...item.data, attunement: 'none', manual_size: true } })
  expect(html).toContain('Параметры экземпляра')
  expect(html).not.toContain('Снять настройку')
})
