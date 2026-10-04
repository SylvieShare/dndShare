import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import SessionEventRow from '@/features/sessions/components/SessionEventRow.vue'
import SessionEventNotification from '@/features/notifications/components/SessionEventNotification.vue'

async function render(component, event) {
  const props = component === SessionEventRow ? { event } : { entry: { data: { event } } }
  const app = createSSRApp({ render: () => h(component, props) })
  app.use(createPinia())
  return renderToString(app)
}

describe('critical results in the chronicle and notifications', () => {
  it.each([['crit', 20, 'Критический успех'], ['fumble', 1, 'Критический провал']])('highlights a stored %s and keeps the total', async (kind, value, label) => {
    const event = { id: 1, type: 'dice_roll', action: 'Атака', createdAt: '2026-10-04T12:00:00Z',
      data: { outcome: { kind, sides: 20, value }, result: { total: value + 3,
        parts: [{ kind: 'dice', sides: 20, rolls: [value] }, { kind: 'flat', sign: '+', value: 3 }] } } }
    for (const component of [SessionEventRow, SessionEventNotification]) {
      const html = await render(component, event)
      expect(html).toContain(`dice-roll-result--${kind}`)
      expect(html).toContain(label)
      expect(html).toContain(`= ${value + 3}`)
    }
  })

  it.each([1, 20])('does not infer a critical outcome from an unmarked natural %s', async value => {
    const event = { id: 1, type: 'dice_roll', action: 'Проверка', data: { result: { total: value, parts: [{ kind: 'dice', sides: 20, rolls: [value] }] } } }
    const html = await render(SessionEventRow, event)
    expect(html).not.toContain('dice-roll-result--crit')
    expect(html).not.toContain('dice-roll-result--fumble')
    expect(html).not.toContain('Критический')
  })
})
