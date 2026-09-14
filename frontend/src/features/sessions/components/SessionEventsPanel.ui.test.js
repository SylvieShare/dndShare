import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { useAccountStore } from '@/stores/account'
import SessionTransferApproval from './SessionTransferApproval.vue'
import SessionEventActorGroup from './SessionEventActorGroup.vue'
import { groupSessionEvents } from '../lib/sessionEventView'
vi.mock('@/features/handbook/components/ItemViewModal.vue', () => ({ default: { render: () => null } }))
const source = readFileSync(new URL('./SessionEventsPanel.vue', import.meta.url), 'utf8')

const rows = [
  { id: 1, type: 'dice_roll', action: 'Атака: Посох', createdAt: '2026-09-13T10:00:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, result: { total: 21, parts: [{ kind: 'dice', sides: 20, rolls: [2, 18], keptIndex: 1, dropped: [0] }, { kind: 'flat', sign: '+', value: 3 }] } } },
  { id: 2, type: 'resource_used', action: 'Восстановление ячеек', createdAt: '2026-09-13T10:01:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, resourceChanges: [{ name: 'Ячейка 2 круга', level: 2, color: '#38bdf8', delta: 2, pool: 'long_rest' }] } },
  { id: 3, type: 'resource_used', action: 'Использование ячеек', createdAt: '2026-09-13T10:02:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, resourceChanges: [{ name: 'Заряды', color: '#38bdf8', delta: -1, pool: 'short_rest' }] } },
]

describe('session chronicle presentation', () => {
  it.each([false, true])('renders author, item, dice and slots for owner=%s', async authorIsSessionOwner => {
    const group = groupSessionEvents(rows.map(row => ({ ...row, authorIsSessionOwner })))[0]
    const app = createSSRApp({ render: () => h(SessionEventActorGroup, { group, items: { 42: { id: 42, name: 'Посох', iconImageUrl: '/staff.png' } } }) })
    app.use(createPinia())
    const html = await renderToString(app)
    if (authorIsSessionOwner) {
      expect(html).toMatch(/<span[^>]*>я<\/span>/)
      expect(html).not.toContain('alice')
    } else expect(html).toContain('alice')
    expect(html).not.toContain('ВЛАДЕЛЕЦ')
    expect(html).toContain('Лиора')
    expect(html.match(/event-item-link/g)).toHaveLength(1)
    expect(html).toContain('/staff.png')
    expect(html).toContain('= 21')
    expect(html).toContain('dice-roll-result-dropped')
    expect(html).toContain('event-resource--spent')
    expect(html).toContain('event-resource--added')
    expect(html).toContain('--ss-c:#38bdf8')
    expect(html).toContain('×2')
    expect(html).toContain('2 круг')
    expect(html).not.toContain('Ячейка 2 круга')
    expect(html).toContain('event-resource-label--level')
    expect(html).toMatch(/<b[^>]*>−<\/b>/)
    expect(html).toMatch(/<b[^>]*>\+<\/b>/)
    expect(html).not.toContain('×1')
    expect(html).not.toContain('Потрачено')
    expect(html).not.toContain('Добавлено')
    expect(html).not.toContain('долгий отдых')
    expect(html).not.toContain('короткий отдых')
  })
  it('places a single action beside its entity and keeps the result below', async () => {
    const row = { ...rows[0], type: 'resource_used', action: 'Использование ячеек: Посох',
      data: { source: { itemId: 42, name: 'Посох' }, resourceChanges: [{ name: 'Заряды', delta: -1, remaining: 2 }] } }
    const app = createSSRApp({ render: () => h(SessionEventActorGroup, {
      group: groupSessionEvents([row])[0], items: { 42: { id: 42, name: 'Посох' } },
    }) })
    app.use(createPinia())
    const html = await renderToString(app)
    const heading = html.slice(html.indexOf('class="event-heading"'), html.indexOf('class="event-body"'))
    expect(heading).toContain('event-item-link')
    expect(heading).toContain('Использование ячеек')
    expect(heading).toContain('(3 → 2)')
    expect(html).not.toContain('Осталось')
    expect(html).not.toContain('event-entity-actions--nested')
  })
  it.each(['pending', 'accepted', 'rejected'])('shows the transfer recipient and a colored status for %s', async status => {
    const row = { ...rows[0], type: 'item_transfer', action: 'Передача: Посох', recipientImageUrl: '/recipient.png',
      data: { source: { itemId: 42, name: 'Посох' }, senderName: 'Лиора', recipientName: 'Торин', status, count: 2 } }
    const app = createSSRApp({ render: () => h(SessionEventActorGroup, { group: groupSessionEvents([row])[0], items: {} }) })
    app.use(createPinia())
    const html = await renderToString(app)
    const detail = html.slice(html.indexOf('class="event-transfer"'))
    expect(detail).toContain('/recipient.png')
    expect(detail).toContain('Торин')
    expect(detail).not.toContain('Лиора')
    expect(detail).toContain(`transfer-status--${status}`)
    expect(detail).toContain('×2')
  })
  it('keeps filter controls, empty states and vertical scrolling available', () => {
    expect(source).toContain('<BasePopover v-model:open="filterOpen"')
    expect(source).toContain('<MultiToggle v-model="authorFilter"')
    expect(source).toContain('v-model:value="actorFilter"')
    expect(source).toContain('По выбранным фильтрам событий нет')
    expect(source).toMatch(/\.sep-list\s*\{[^}]*overflow-x:\s*hidden;/s)
  })
})

it.each([[1, 'pending', true], [2, 'pending', false], [1, 'accepted', false], [1, 'rejected', false]])('approval availability for user %s status %s', async (userId, status, visible) => {
  const pinia = createPinia()
  useAccountStore(pinia).user = { id: userId }
  const app = createSSRApp({ render: () => h(SessionTransferApproval, { event: { id: 1, sessionOwnerUserId: 1, data: { status } } }) })
  app.use(pinia)
  expect((await renderToString(app)).includes('Принять передачу')).toBe(visible)
})
