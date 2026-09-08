import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import DndDiaryEventRow from './components/DndDiaryEventRow.vue'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const workspace = read('../../../journals/components/JournalWorkspace.vue')
const timeline = read('./components/DndDiarySessionCard.vue')
const row = read('./components/DndDiaryEventRow.vue')
describe('journal reading and inline editing', () => {
  it('puts the source switch in the cover and only renders the selected section', () => {
    const cover = workspace.match(/<header class="journal-cover">[\s\S]*?<\/header>/)[0]
    expect(cover).toContain('<JournalSourceSwitch')
    expect(cover).toContain("sessionUuid && canManage && journal.kind === 'session'")
    expect(workspace).toContain('<JournalSectionTabs')
    expect(workspace).toContain('<DndDiarySessionCard v-if="selectedSection"')
    expect(workspace).not.toContain('MorphEditorShell')
    expect(workspace).not.toContain('DndDiaryEventEditor')
    const tabs = read('../../../journals/components/JournalSectionTabs.vue')
    expect(tabs).toContain('overflow-x: auto')
    expect(tabs.indexOf('Новый раздел')).toBeLessThan(tabs.indexOf('role="tablist"'))
  })
  it('connects event cards through the center and drags by their header', () => {
    expect(timeline).toContain('left: calc(50% - 1px)')
    expect(timeline).not.toContain('GripVertical')
    expect(timeline).not.toContain('dsc-head')
    expect(timeline).toContain('useSortable')
    expect(row).toContain('@pointerdown="drag"')
    expect(row).toContain("pointer.target.closest('button, input, textarea, a, [contenteditable=\"true\"]')")
    expect(row).toContain('event.target !== event.currentTarget')
    expect(timeline.indexOf('<JournalEventTypePicker')).toBeLessThan(timeline.indexOf('class="diary-timeline"'))
  })
  it('renders colored dialogue without type counters, with inline pencils and delete', async () => {
    const html = await renderToString(createSSRApp(DndDiaryEventRow, {
      event: { id: '1', type: 'dialog', title: 'У ворот', desc: '', dialogue: [{ id: 'a', speaker: 'Страж', text: 'Стой!' }], combatants: [] },
      editable: true, saveEvent: async () => {},
    }))
    expect(html).toContain('У ворот')
    expect(html).toContain('Страж')
    expect(html).toContain('Стой!')
    expect(html).toContain('--voice:')
    expect(html).toContain('Редактировать реплику')
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
    expect(html).not.toContain('Изменить название')
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
})
