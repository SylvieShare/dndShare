import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import BlockMoneyView from './BlockMoneyView.vue'

const svg = '<svg viewBox="0 0 64 64"><circle r="20"/></svg>'
const render = coin => renderToString(createSSRApp({ render: () => h(BlockMoneyView, {
  coins: [{ id: 3, title: 'зм', amount: 42, ...coin }],
}) }))

describe('money artwork', () => {
  it('embeds a keyboard-accessible wallet icon and balances without a second surface or heading', async () => {
    const html = await renderToString(createSSRApp({ render: () => h(BlockMoneyView, {
      inline: true, editable: true, title: 'Кошелёк', coins: [{ id: 3, title: 'зм', amount: 42 }],
    }) }))
    expect(html).toContain('aria-label="Изменить кошелёк"')
    expect(html).toContain('lucide-wallet')
    expect(html).toContain('42')
    expect(html).not.toContain('morph-tile-header')
    expect(html).not.toContain('base-tile')
  })
  it('shows the shared WebP in preference to SVG without recoloring it', async () => {
    const html = await render({ iconImageUrl: '/gold.webp', svg })
    expect(html).toContain('src="/gold.webp"')
    expect(html).toContain('42')
    expect(html).not.toContain('<circle')
    expect(html).not.toContain('filter:')
  })
  it('still renders SVG coins inline and missing icons as color dots', async () => {
    expect(await render({ svg })).toContain('<circle')
    expect(await render({ color: 'var(--text-muted)' })).toContain('ma-dot')
  })
})
