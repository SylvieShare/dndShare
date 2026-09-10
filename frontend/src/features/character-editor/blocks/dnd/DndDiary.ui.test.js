import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import DndDiaryEventRow from './components/DndDiaryEventRow.vue'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const workspace = read('../../../journals/components/JournalWorkspace.vue')
const timeline = read('../../../journals/components/JournalTimeline.vue')
const row = read('./components/DndDiaryEventRow.vue')
describe('journal reading and inline editing', () => {
  it('puts the source switch in the cover and only renders the selected section', () => {
    const cover = workspace.match(/<header class="journal-cover">[\s\S]*?<\/header>/)[0]
    expect(cover).toContain('<JournalSourceSwitch')
    expect(cover).toContain("sessionUuid && canManage && journal.kind === 'session'")
    expect(workspace).toContain('<JournalSectionTabs')
    const header = workspace.match(/<BaseTile class="journal-header">[\s\S]*?<\/BaseTile>/)[0]
    expect(header).toContain('<header class="journal-cover">')
    expect(header).toContain('<JournalSectionTabs')
    expect(workspace).toContain('<JournalTimeline v-if="selectedSection"')
    expect(workspace).not.toContain('MorphEditorShell')
    expect(workspace).not.toContain('DndDiaryEventEditor')
    const tabs = read('../../../journals/components/JournalSectionTabs.vue')
    expect(tabs).toContain('overflow-x: auto')
    expect(tabs.indexOf('Новый раздел')).toBeLessThan(tabs.indexOf('role="tablist"'))
  })
  it('uses a content-height timeline with actions at the top right and native touch scrolling', () => {
    expect(timeline).not.toContain('NarrativeGraphCanvas')
    expect(timeline).not.toContain('journal-event-panel')
    expect(timeline).toContain('useSortable')
    expect(timeline).toContain(':allow-drag="!touchPointer && filter === \'all\'"')
    expect(timeline).toContain('diary-order-actions')
    expect(timeline).toContain('diary-section-toolbar')
    expect(timeline).toContain('margin-left: auto')
    expect(timeline).not.toContain('diary-timeline-toolbar')
    expect(timeline).not.toContain('node-height')
    expect(timeline.indexOf('<JournalEventTypePicker')).toBeLessThan(timeline.indexOf('data-sortable-container'))
  })
  it('renders colored dialogue with a single entry edit action and delete', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: '1', type: 'dialog', title: 'У ворот', desc: '', dialogue: [{ id: 'a', speaker: 'Страж', text: 'Стой!' }], combatants: [] },
      editable: true, saveEvent: async () => {},
    }))
    expect(html).toContain('У ворот')
    expect(html).toContain('Страж')
    expect(html).toContain('Стой!')
    expect(html).toContain('--voice:')
    expect(html).toContain('Редактировать запись')
    expect(html).not.toContain('Редактировать реплику')
    expect(html).toContain('Удалить событие')
    expect(html).not.toContain('Голосов:')
    expect(html).not.toContain('Участников:')
  })
  it('keeps read-only entries free of editing and dragging controls', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: '1', type: 'newday', title: 'Рассвет', desc: '', dialogue: [], combatants: [] }, saveEvent: async () => {},
    }))
    expect(html).toContain('Рассвет')
    expect(html).not.toContain('Удалить событие')
    expect(html).not.toContain('Редактировать запись')
    expect(html).not.toContain('tabindex="0"')
    expect(html).not.toContain('НОВЫЙ ДЕНЬ')
  })
  it('uses one shared footer for all event types', () => {
    expect(row.match(/<DndDiaryEventMetadata/g)).toHaveLength(1)
    const metadata = read('./components/DndDiaryEventMetadata.vue')
    expect(metadata).toContain('<ItemTooltip')
    expect(metadata).toContain('@focus=')
    expect(row).toContain('<BaseTile')
  })
  it('shows task checklists and hides author/time behind the header info icon', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: 'quest', type: 'quest', title: 'Маяк', desc: 'До рассвета', createdAt: '2026-09-10T19:00:00Z', authorName: 'Лиссара',
        quest: { reward: 'Карта', objectives: [{ id: 'key', text: 'Найти ключ', done: true }, { id: 'lens', text: 'Разрушить линзу', done: false }] } },
      editable: false, saveEvent: async () => {},
    }))
    expect(html).toContain('Найти ключ')
    expect(html).toContain('Разрушить линзу')
    expect(html).toContain('1 / 2 пунктов')
    expect(html).toContain('role="checkbox"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('disabled')
    expect(html).toContain('Карта')
    expect(html).not.toContain('Лиссара')
    expect(html).not.toContain('datetime="2026-09-10T19:00:00Z"')
    expect(html).toContain('Информация о записи')
    expect(html.indexOf('diary-meta')).toBeLessThan(html.indexOf('journal-quest-progress'))
    expect(html).not.toContain('link-chip')
    expect(html).not.toContain('Редактировать пункт')
  })
  it('frames every entry with an icon only in its header, without watermarks', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: 'h', type: 'header', title: 'Перед рассветом', desc: 'Не показывается' }, saveEvent: async () => {},
    }))
    expect(html).toContain('base-tile--framed')
    expect(html).not.toContain('diary-event-watermark')
    expect(html).toContain('diary-event-icon')
    expect(html).toContain('Перед рассветом')
    expect(html).not.toContain('diary-event-content')
    expect(html).not.toContain('Не показывается')
    expect(row).not.toContain('watermark')
  })
  it('renders bestiary artwork and resolves names for imported battles', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: '1', type: 'battle', title: 'Засада', combatants: [
        { id: 'a', source: 'handbook', itemId: 42, count: 3 },
        { id: 'b', source: 'handbook', itemId: 43, itemName: 'Прежнее имя', count: 1 },
      ] },
      itemsById: new Map([
        ['42', { id: 42, name: 'Гоблин', iconImageUrl: '/api/images/goblin' }],
        ['43', { id: 43, name: 'Новое имя', svg: '<svg viewBox="0 0 24 24"><path d="M1 1L2 2" /></svg>' }],
      ]),
      saveEvent: async () => {},
    }))
    expect(html).toContain('src="/api/images/goblin"')
    expect(html).toContain('item-icon__svg')
    expect(html).toContain('Гоблин')
    expect(html).toContain('Прежнее имя')
    expect(html).not.toContain('Новое имя')
    expect(html).toContain('×3')
    expect(html).not.toContain('×1')
    expect(html).not.toContain('diary-combatant-stats')
  })
  it('keeps unavailable creatures readable and does not resolve custom creatures by item id', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: '1', type: 'battle', title: 'Засада', combatants: [
        { id: 'a', source: 'handbook', itemId: 99, itemName: 'Василиск', count: 1 },
        { id: 'b', source: 'handbook', itemId: 100, count: 1 },
        { id: 'c', source: 'custom', itemId: 42, name: 'Стражник', count: 1, ac: 12, hp: 8 },
      ] },
      itemsById: new Map([['42', { id: 42, name: 'Гоблин', iconImageUrl: '/api/images/goblin' }]]),
      saveEvent: async () => {},
    }))
    expect(html).toContain('Василиск')
    expect(html).toContain('Существо #100')
    expect(html).toContain('item-icon--placeholder')
    expect(html).toContain('Стражник')
    expect(html).toContain('diary-combatant-stats')
    expect(html).not.toContain('Гоблин')
    expect(html).not.toContain('/api/images/goblin')
  })
  it('loads creature references once per section rather than per battle row', () => {
    expect(timeline).toContain('useItemReferenceMap(itemIds)')
    expect(timeline).toContain("creature.source === 'handbook'")
    expect(timeline).toContain(':items-by-id="itemsById"')
    expect(row).toContain(':items-by-id="itemsById"')
    expect(read('./components/DndDiaryCombatants.vue')).not.toContain('useItemReferenceMap')
  })
})
