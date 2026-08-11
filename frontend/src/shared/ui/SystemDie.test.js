import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import SystemDie from './SystemDie.vue'

async function renderDie(props) {
  return renderToString(createSSRApp({ render: () => h(SystemDie, props) }))
}

describe('SystemDie', () => {
  it('renders the recovered d6 artwork with its maximum face by default', async () => {
    const html = await renderDie({ sides: 'd6', animated: false })

    expect(html).toContain('viewBox="0 0 56 56"')
    expect(html).toContain('M14 8 H42 A6 6 0 0 1 48 14')
    expect(html).toContain('aria-label="d6: 6"')
    expect(html).toContain('font-size:27px')
    expect(html).toContain('>6</text>')
  })

  it('substitutes an arbitrary value and scales long text to fit', async () => {
    const html = await renderDie({ sides: 'd20', value: 1234 })

    expect(html).toContain('aria-label="d20: 1234"')
    expect(html).toContain('font-size:12px')
    expect(html).toContain('stroke-width:2px')
    expect(html).toContain('>1234</text>')
  })
})
