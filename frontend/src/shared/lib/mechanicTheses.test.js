import { expect, it } from 'vitest'
import { mechanicTheses } from './mechanicTheses'
it('uses existing list items and paragraphs without repeating identical requirements', () => {
  expect(mechanicTheses('<ul><li>Попадание.</li><li><b>Цель</b> в пределах 30 футов.</li></ul>', ['Попадание', 'Цель в пределах 30 футов', 'Раз в ход']))
    .toEqual([{ html: 'Попадание.' }, { html: '<b>Цель</b> в пределах 30 футов.' }, { text: 'Раз в ход' }])
})
it('keeps interactive rich nodes and unfamiliar markup intact', () => {
  const rich = '<span data-dnd-type="dice" data-expression="2d6"></span>'
  expect(mechanicTheses(`<p>Урон ${rich}</p><p>Длительность — 1 час.</p>`)[0].html).toContain(rich)
  const other = '<blockquote><p>Правило</p></blockquote>'
  expect(mechanicTheses(other)).toEqual([{ html: other }])
})
it('deduplicates widget theses while retaining order', () => {
  expect(mechanicTheses('', ['Раз в ход.', 'раз в ход', 'С преимуществом'])).toEqual([{ text: 'Раз в ход.' }, { text: 'С преимуществом' }])
})

it('does not merge visually similar rich rows with different dice payloads', () => {
  expect(mechanicTheses('<p>Урон <span data-dice="1d6"></span></p><p>Урон <span data-dice="2d6"></span></p>')).toHaveLength(2)
  expect(mechanicTheses('<p><span data-dice="1d6"></span></p>')).toHaveLength(1)
})

it('presents edited plain paragraphs as separate theses without rewriting saved content', () => {
  const html = '<p>Потратьте 1 заряд трезубца, чтобы наложить «Доминирование над зверем» со Сл спасброска 15. Примените остальные условия заклинания.</p>'
  expect(mechanicTheses(html, ['Зверь с врождённой скоростью плавания'])).toEqual([
    { html: 'Потратьте 1 заряд трезубца, чтобы наложить «Доминирование над зверем» со Сл спасброска 15.' },
    { html: 'Примените остальные условия заклинания.' },
    { text: 'Зверь с врождённой скоростью плавания' },
  ])
})
