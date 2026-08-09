import { describe, expect, it } from 'vitest'
import { formatLayoutTitlePart, resolveLayoutTitle } from './templateSchema'

describe('layout title formatting', () => {
  it('renders item references by name and keeps legacy scalar values', () => {
    const data = {
      values: {
        name: 'Лиссара',
        race: { id: 8, name: 'Эльф' },
        class: { id: 9, name: 'Следопыт' },
        level: 4,
      },
    }

    expect(resolveLayoutTitle(
      ['values.name', 'values.race', 'values.class', 'values.level'],
      data,
    )).toBe('Лиссара • Эльф • Следопыт • 4')
  })

  it('omits unknown objects instead of stringifying them', () => {
    expect(formatLayoutTitlePart({ id: 8 })).toBe('')
    expect(resolveLayoutTitle(['values.name', 'values.race'], {
      values: { name: 'Лиссара', race: { id: 8 } },
    })).toBe('Лиссара')
  })
})
