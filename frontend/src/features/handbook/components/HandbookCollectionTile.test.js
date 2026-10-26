import { describe, expect, it } from 'vitest'
import { renderComponent } from '../../../../tests/unit/renderComponent'
import HandbookCollectionTile from './HandbookCollectionTile.vue'

const type = { id: 5, name: 'Заклинания', description: 'Описание <script>без HTML</script>', countItems: 205 }
describe('collection tile content', () => {
  it('preserves accessible text and count without requesting an absent illustration', async () => {
    const html = await renderComponent(HandbookCollectionTile, { type })
    expect(html).toContain('<button')
    expect(html).toContain('Заклинания')
    expect(html).toContain('205')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('Основной каталог')
  })
  it('identifies a child collection and keeps its illustration decorative', async () => {
    const html = await renderComponent(HandbookCollectionTile, { type: { ...type, iconImageUrl: '/icon.webp' }, parentName: 'Магия' })
    expect(html).toContain('Раздел «Магия»')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('src="/icon.webp"')
  })
  it('shows children of a root without inventing an extra collection', async () => {
    const html = await renderComponent(HandbookCollectionTile, { type, childNames: 'Умения · Ритуалы' })
    expect(html).toContain('Основной каталог')
    expect(html).toContain('Подразделы: Умения · Ритуалы')
    expect(html.match(/<button/g)).toHaveLength(1)
  })
})
