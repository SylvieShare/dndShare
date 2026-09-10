import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import JournalEventFields from './JournalEventFields.vue'
import { defaultCombatant, defaultDialogueLine, defaultEvent, EVENT_TYPES } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

vi.mock('@/shared/ui/InputDescription.vue', () => ({ default: { template: '<div data-rich-editor />' } }))

describe('whole entry fields', () => {
  it.each(EVENT_TYPES.map(type => type.value))('stacks every labeled field above its input for %s', async type => {
    const value = { ...defaultEvent(), type, dialogue: [defaultDialogueLine()], combatants: [defaultCombatant()] }
    const html = await renderToString(createSSRApp(JournalEventFields, { value }))
    const fields = html.match(/class="form-field(?:\s[^\"]*)?"/g)
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.every(field => field.includes('form-field--vertical'))).toBe(true)
  })
  it('keeps long quest objectives and rewards multiline', async () => {
    const value = { ...defaultEvent(), type: 'quest', quest: { reward: 'Карта', objectives: [{ id: '1', text: 'Найти путь', done: false }] } }
    const html = await renderToString(createSSRApp(JournalEventFields, { value }))
    expect(html).toMatch(/<textarea[^>]*aria-label="Текст пункта"/)
    expect(html).toMatch(/<textarea[^>]*aria-label="Награда"/)
  })
  it('edits a header as title only, without a type selector', async () => {
    const html = await renderToString(createSSRApp(JournalEventFields, { value: { ...defaultEvent(), type: 'header', title: 'Глава' } }))
    expect(html).toContain('Название записи')
    expect(html).toContain('Глава')
    expect(html).not.toContain('Описание')
    expect(html).not.toContain('select')
  })
})
