import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import OriginListItem from './OriginListItem.vue'

vi.mock('@/features/handbook/objects/lib/itemNames', () => ({
  itemName: () => 'Волшебник', ensureItemNames: vi.fn(),
}))

describe('class emblems in handbook rows', () => {
  it.each([9, 17])('shows the dedicated icon instead of the cover for type %s', async typeId => {
    const html = await renderToString(createSSRApp(OriginListItem, {
      item: { id: 10, typeId, name: 'Школа магии', iconImageUrl: '/school-icon.webp', coverImageUrl: '/school-cover.jpg', data: {} },
      type: { id: typeId },
    }))
    expect(html).toContain('src="/school-icon.webp"')
    expect(html).not.toContain('/school-cover.jpg')
    expect(html).not.toContain('origin-list-portrait')
  })

  it('does not turn a class cover into an icon when no emblem is assigned', async () => {
    const html = await renderToString(createSSRApp(OriginListItem, {
      item: { id: 10, typeId: 9, name: 'Магус', coverImageUrl: '/cover.jpg', data: {} },
      type: { id: 9 },
    }))
    expect(html).not.toContain('/cover.jpg')
    expect(html).toContain('origin-list-monogram')
  })
})
