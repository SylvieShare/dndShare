import { h } from 'vue'
import { renderComponent } from '../../../../../tests/unit/renderComponent'
import { expect, it } from 'vitest'
import IllustratedChoiceStage from './IllustratedChoiceStage.vue'

async function render(props) {
  return renderComponent(IllustratedChoiceStage, props, { slots: {
    cards: () => h('article', 'Выбор из справочника'),
    details: () => h('section', 'Данные выбранного варианта'),
  } })
}

it.each(['Раса', 'Класс', 'Предыстория'])('%s shows cards before selection and details with a back action afterwards', async title => {
  const initial = await render({ title, selected: false, twoColumn: true })
  expect(initial).toContain(title)
  expect(initial).toContain('Выбор из справочника')
  expect(initial).not.toContain('Данные выбранного варианта')
  expect(initial).toContain('illustrated-choice-list--two-column')
  const selected = await render({ title, selected: true, selectionKey: 7, backText: 'К выбору', twoColumn: true })
  expect(selected).toContain('Данные выбранного варианта')
  expect(selected).toContain('К выбору')
  expect(selected).not.toContain('illustrated-choice-list--two-column')
})

it.each(['Раса', 'Класс', 'Предыстория'])('%s distinguishes loading from an empty catalogue', async title => {
  const loading = await render({ title, loading: true, loadingText: 'Запрашиваем данные' })
  expect(loading).toContain('Запрашиваем данные')
  expect(loading).not.toContain('Выбор из справочника')
  const empty = await render({ title, empty: true, emptyText: 'Нет вариантов для этой редакции' })
  expect(empty).toContain('Нет вариантов для этой редакции')
  expect(empty).not.toContain('Выбор из справочника')
})
