import { describe, expect, it } from 'vitest'

import { entryDisplayData } from './itemSection'

describe('inventory item presentation', () => {
  it('exposes the handbook SVG for a referenced item', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>'
    const result = entryDisplayData(
      { id: 47, override: null },
      { 47: { id: 47, name: 'Алебарда', svg, data: {} } },
    )

    expect(result).toMatchObject({ name: 'Алебарда', svg, isCustom: false })
  })

  it('marks a simplified entry for the dedicated placeholder icon', () => {
    const result = entryDisplayData(
      { id: null, override: { name: 'Верёвка' } },
      {},
    )

    expect(result).toMatchObject({ name: 'Верёвка', svg: '', isCustom: true })
  })

  it('does not invent an icon for a referenced item without SVG', () => {
    const result = entryDisplayData(
      { id: 9001, override: null },
      { 9001: { id: 9001, name: 'Авторский предмет', data: {} } },
    )

    expect(result).toMatchObject({ svg: '', isCustom: false })
  })
})
