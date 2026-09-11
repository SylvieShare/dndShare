import { expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import DndActionsView from './components/DndActionsView.vue'

const render = action => renderToString(createSSRApp({ render: () => h(DndActionsView, {
  groups: [{ value: 'bonus_action', label: 'Бонусное действие', actions: [{ key: 'test', readonly: true, ...action }] }],
}) }))

it('renders Cunning Action as ordinary prose without a thesis list', async () => {
  const html = await render({ title: 'Хитрое действие', description: 'Совершите одно из стандартных действий бонусным действием.' })
  expect(html).toContain('dav-description')
  expect(html).toContain('Совершите одно из стандартных действий бонусным действием.')
  expect(html).not.toContain('class="mechanic-theses"')
})

it('keeps the authored description together and lists only distinct conditions below it', async () => {
  const description = '<p>Наложите заклинание. Выберите цель.</p>'
  const html = await render({ title: 'Управление рыбами', description, requirements: ['Зверь со скоростью плавания', 'Раз в ход', 'Раз в ход.'] })
  expect(html).toContain('Наложите заклинание. Выберите цель.')
  const theses = html.slice(html.indexOf('<ul class="mechanic-theses"')).split('</ul>')[0]
  expect(theses).toContain('Зверь со скоростью плавания')
  expect(theses.match(/Раз в ход/g)).toHaveLength(1)
  expect(theses).not.toContain('Наложите заклинание')
})
