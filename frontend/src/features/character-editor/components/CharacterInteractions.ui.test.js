import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import SessionEventRow from '@/features/sessions/components/SessionEventRow.vue'
import CharacterInteractionInbox from './CharacterInteractionInbox.vue'

async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) })
  app.use(createPinia())
  return renderToString(app)
}
const data = { senderCharUuid: 'sender', recipientCharUuid: 'recipient', senderName: 'Лиора', recipientName: 'Торин' }
describe('interaction event rendering', () => {
  it('renders messages as escaped text in the chronicle', async () => {
    const html = await render(SessionEventRow, { event: { id: 1, type: 'chat_message', action: 'Сообщение', createdAt: '2026-09-14T12:00:00Z', data: { ...data, message: '<img src=x onerror=alert(1)>Привет' } } })
    expect(html).toContain('Торин: &lt;img')
    expect(html).not.toContain('<img src=x')
  })
  it('groups unread messages by sender and keeps incoming and outgoing challenges actionable', async () => {
    const rows = [1, 2].map(id => ({ id, type: 'chat_message', data }))
    rows.push({ id: 3, type: 'rps_challenge', data: { ...data, status: 'pending' } })
    const html = await render(CharacterInteractionInbox, { characterUuid: 'recipient', controller: { state: { pending: rows }, openEvent() {} } })
    expect(html).toContain('Непрочитанных сообщений: 2')
    expect(html).toContain('Открыть чат')
    expect(html).toContain('Открыть вызов')
    expect(html.match(/interaction-incoming"/g)).toHaveLength(2)
  })
  it('renders the shared result in the chronicle and highlights both players on a draw', async () => {
    const html = await render(SessionEventRow, { event: { id: 3, type: 'rps_challenge', action: 'Камень / ножницы / бумага',
      createdAt: '2026-10-04T12:00:00Z', data: { ...data, status: 'completed', senderChoice: 'rock', recipientChoice: 'rock' } } })
    expect(html).toContain('rps-result')
    expect(html).toContain('VS')
    expect(html).toContain('Ничья')
    expect(html.match(/rps-contestant--draw/g)).toHaveLength(2)
    expect(html).toContain('var(--warning)')
    expect(html).not.toContain('rps-contestant--winner')
  })
})
