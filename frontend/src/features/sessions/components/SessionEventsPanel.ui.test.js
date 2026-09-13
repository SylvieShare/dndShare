import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import SessionEventActorGroup from './SessionEventActorGroup.vue'
import { groupSessionEvents } from '../lib/sessionEventView'
vi.mock('@/features/handbook/components/ItemViewModal.vue', () => ({ default: { render: () => null } }))
const source = readFileSync(new URL('./SessionEventsPanel.vue', import.meta.url), 'utf8')

const rows = [
  { id: 1, type: 'dice_roll', action: 'Атака: Посох', createdAt: '2026-09-13T10:00:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, result: { total: 21, parts: [{ kind: 'dice', sides: 20, rolls: [2, 18], keptIndex: 1, dropped: [0] }, { kind: 'flat', sign: '+', value: 3 }] } } },
  { id: 2, type: 'resource_used', action: 'Восстановление ячеек', createdAt: '2026-09-13T10:01:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, resourceChanges: [{ name: 'Заряды', color: '#38bdf8', delta: 2 }] } },
  { id: 3, type: 'resource_used', action: 'Использование ячеек', createdAt: '2026-09-13T10:02:00Z', actorName: 'Лиора', authorName: 'alice', authorUserId: 1,
    data: { source: { itemId: 42, name: 'Посох' }, resourceChanges: [{ name: 'Заряды', color: '#38bdf8', delta: -1 }] } },
]

describe('session chronicle presentation', () => {
  it('renders one item reference, user name, actual dice and colored spent/recovered slots', async () => {
    const group = groupSessionEvents(rows)[0]
    const app = createSSRApp({ render: () => h(SessionEventActorGroup, { group, items: { 42: { id: 42, name: 'Посох', iconImageUrl: '/staff.png' } } }) })
    app.use(createPinia())
    const html = await renderToString(app)
    expect(html).toContain('alice')
    expect(html).toContain('Лиора')
    expect(html.match(/event-item-link/g)).toHaveLength(1)
    expect(html).toContain('/staff.png')
    expect(html).toContain('= 21')
    expect(html).toContain('dice-roll-result-dropped')
    expect(html).toContain('event-resource--spent')
    expect(html).toContain('event-resource--added')
    expect(html).toContain('--ss-c:#38bdf8')
    expect(html).toContain('×2')
    expect(html).toContain('Потрачено')
    expect(html).toContain('Добавлено')
  })
  it('keeps filter controls, empty states and vertical scrolling available', () => {
    expect(source).toContain('<BasePopover v-model:open="filterOpen"')
    expect(source).toContain('<MultiToggle v-model="authorFilter"')
    expect(source).toContain('v-model:value="actorFilter"')
    expect(source).toContain('По выбранным фильтрам событий нет')
    expect(source).toMatch(/\.sep-list\s*\{[^}]*overflow-x:\s*hidden;/s)
  })
})
