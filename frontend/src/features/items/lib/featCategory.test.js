import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { FEAT_CATEGORIES, featCategoryLabel } from './featCategory'
import FeatListItem from '../list-components/FeatListItem.vue'

describe('feat categories', () => {
  it.each(Object.entries(FEAT_CATEGORIES))('renders %s as %s in the shared list row', async (category, label) => {
    const html = await renderToString(createSSRApp(FeatListItem, { item: { id: 1, name: 'Черта', data: { category } }, interactive: true }))
    expect(html).toContain(label)
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
  })
  it('does not invent a category for 2014 or homebrew feats', () => {
    expect(featCategoryLabel({ data: {} })).toBe('')
    expect(featCategoryLabel({ data: { category: 'custom' } })).toBe('')
  })
})
