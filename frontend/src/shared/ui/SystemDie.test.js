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
    expect(html).not.toContain('system-die__speck')
    expect(html).toContain('system-die__bubble--1" cx="17" cy="49" r="2.8"')
  })

  it('substitutes an arbitrary value and scales long text to fit', async () => {
    const html = await renderDie({ sides: 'd20', value: 1234 })

    expect(html).toContain('aria-label="d20: 1234"')
    expect(html).toContain('font-size:12px')
    expect(html).toContain('stroke-width:2px')
    expect(html).toContain('>1234</text>')
  })

  it('gives every rendered die unique SVG definition ids', async () => {
    const html = await renderToString(createSSRApp({
      render: () => h('div', [4, 6, 8].map((sides) => h(SystemDie, { sides }))),
    }))
    const clipIds = [...html.matchAll(/id="(system-die-clip-[^"]+)"/g)].map((match) => match[1])
    const glowIds = [...html.matchAll(/id="(system-die-glow-[^"]+)"/g)].map((match) => match[1])

    expect(new Set(clipIds).size).toBe(3)
    expect(new Set(glowIds).size).toBe(3)
  })
})
