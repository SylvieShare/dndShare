import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import NarrativeGraphCanvas from '@/features/narrative-graph/components/NarrativeGraphCanvas.vue'
import JournalGraphNode from './JournalGraphNode.vue'

describe('journal canvas composition', () => {
  it('renders the real shared canvas and its SVG edges without setup errors', async () => {
    const nodes = [{ id: 'a', title: 'Разделение', positionX: 0, positionY: 0 }, { id: 'b', title: 'Встреча', positionX: 100, positionY: -220 }]
    const html = await renderToString(createSSRApp({ render: () => h(NarrativeGraphCanvas,
      { graphKey: 'journal:test', nodes, edges: [{ id: 'a:b', fromId: 'a', toId: 'b' }], fromKey: 'fromId', toKey: 'toId', canEdit: false },
      { node: ({ node }) => h('strong', node.title) }) }))
    expect(html).toContain('Разделение')
    expect(html).toContain('Встреча')
    expect(html).toContain('marker-end')
    expect(html).toContain('translate(100px, -220px)')
    expect(html).not.toContain('nested-graph-link-port')
  })
  it('renders only a compact battle preview with handbook icons', async () => {
    const html = await renderToString(createSSRApp(JournalGraphNode, {
      event: { id: 'a', type: 'battle', title: 'Засада', combatants: [1, 2, 3, 4].map(id => ({ id, source: 'handbook', itemId: id, count: 2 })), dialogue: [] },
      itemsById: new Map([['1', { name: 'Гоблин', iconImageUrl: '/goblin.png' }]]),
    }))
    expect(html).toContain('/goblin.png')
    expect(html).toContain('Гоблин')
    expect(html.match(/×2/g)).toHaveLength(3)
    expect(html).not.toContain('Участников:')
    expect(html).not.toContain('Редактировать')
  })
  it('keeps dialogue colors and bounds the preview to two voices', async () => {
    const html = await renderToString(createSSRApp(JournalGraphNode, {
      event: { id: 'a', type: 'dialog', title: 'Ворота', combatants: [], dialogue: [
        { id: '1', speaker: 'Страж', text: 'Кто идёт?', color: '#ffcc00' },
        { id: '2', speaker: 'Лиссара', text: 'Путники' },
        { id: '3', speaker: 'Не раскрывать', text: 'Полный текст в панели' },
      ] },
    }))
    expect(html).toContain('--voice:#ffcc00')
    expect(html).toContain('Путники')
    expect(html).not.toContain('Не раскрывать')
  })
})
