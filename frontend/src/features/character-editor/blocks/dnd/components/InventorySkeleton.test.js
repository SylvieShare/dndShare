import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import InventorySkeleton from './InventorySkeleton.vue'

async function render(sections) {
  return renderToString(createSSRApp({ render: () => h(InventorySkeleton, { sections }) }))
}

describe('inventory loading structure', () => {
  it('uses the actual sections and item counts, including empty sections', async () => {
    const html = await render([
      { id: 'equipped', name: 'Надето', items: [{ uid: 'a' }, { uid: 'b' }] },
      { id: 'bag', name: 'Рюкзак', items: [] },
    ])
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Надето')
    expect(html).toContain('Рюкзак')
    expect(html.match(/class="di-row"/g)).toHaveLength(2)
    expect(html.match(/di-section-head/g)).toHaveLength(2)
    expect(html).not.toContain('<button')
  })

  it('does not invent rows or sections when the structure is empty', async () => {
    const html = await render([])
    expect(html).not.toContain('di-section-head')
    expect(html).not.toContain('class="di-row"')
  })
})
