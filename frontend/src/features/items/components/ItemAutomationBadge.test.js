import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ItemAutomationBadge from './ItemAutomationBadge.vue'
import ItemAutomationEditor from '../editor/ItemAutomationEditor.vue'

const render = (component, props) => renderToString(createSSRApp({ render: () => h(component, props) }))
describe('automation metadata UI', () => {
  it('shows an unreviewed status, not a claim of missing mechanics', async () => {
    const html = await render(ItemAutomationBadge, { item: { id: 1 } })
    expect(html).toContain('Автоматизация: не оценено')
    expect(html).not.toContain('Другие игроки')
  })
  it('combines full support with other players and escapes authored comments', async () => {
    const html = await render(ItemAutomationBadge, { item: { id: 1, automationStatus: 'full', requiresPlayerInteraction: true, automationNote: '<script>bad()</script>' } })
    expect(html).toContain('Автоматизация: полностью')
    expect(html).toContain('Другие игроки')
    expect(html).not.toContain('<script>')
  })
  it('offers all statuses and labelled optional metadata without help buttons', async () => {
    const html = await render(ItemAutomationEditor, { data: { automationStatus: 'partial', automationNote: '', requiresPlayerInteraction: false } })
    expect(html.match(/<option /g)).toHaveLength(5)
    expect(html).toContain('aria-label="Комментарий к поддержке"')
    expect(html).toContain('maxlength="1000"')
    expect(html).not.toContain('<p>')
    expect(html).not.toContain('help-button')
  })
})
