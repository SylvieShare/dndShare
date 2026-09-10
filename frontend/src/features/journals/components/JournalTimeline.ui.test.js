import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import JournalTimeline from './JournalTimeline.vue'

// The closed, teleported type picker is browser-only; render the actual timeline and cards.
vi.mock('@sylvieshare/share-ui', async original => ({ ...await original(), BasePopover: { render: () => null } }))

describe('vertical journal rendering', () => {
  it('shows complete event content newest first without a canvas or side panel', async () => {
    const html = await renderToString(createSSRApp(JournalTimeline, {
      session: { id: 's', title: 'Раздел', events: [
        { id: '1', type: 'newday', title: 'Ранний рассвет', desc: '', dialogue: [], combatants: [] },
        { id: '2', type: 'event', title: 'Встреча у ворот', desc: 'Длинная история '.repeat(100) + 'Последняя строка', dialogue: [], combatants: [] },
      ] }, ownerMode: false, saveEvent: async () => {},
    }))
    expect(html.indexOf('Встреча у ворот')).toBeLessThan(html.indexOf('Ранний рассвет'))
    expect(html).toContain('Последняя строка')
    expect(html).not.toContain('nested-graph-canvas')
    expect(html).not.toContain('journal-event-panel')
    expect(html).not.toContain('Удалить событие')
  })
  it('puts creation before the events and retains inline editing', async () => {
    const html = await renderToString(createSSRApp(JournalTimeline, {
      session: { id: 's', title: 'Раздел', events: [{ id: '1', type: 'event', title: 'Запись', desc: '', dialogue: [], combatants: [] }] },
      ownerMode: true, saveEvent: async () => {},
    }))
    expect(html.indexOf('Добавить событие')).toBeLessThan(html.indexOf('diary-timeline-event'))
    expect(html).toContain('Изменить название')
    expect(html).toContain('Редактировать описание')
    expect(html).not.toContain('История растёт вверх')
  })
})
