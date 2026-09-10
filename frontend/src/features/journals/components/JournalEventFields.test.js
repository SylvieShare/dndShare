import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import JournalEventFields from './JournalEventFields.vue'
import { defaultEvent } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

describe('whole entry fields', () => {
  it('edits a header as title only, without a type selector', async () => {
    const html = await renderToString(createSSRApp(JournalEventFields, { value: { ...defaultEvent(), type: 'header', title: 'Глава' } }))
    expect(html).toContain('Название записи')
    expect(html).toContain('Глава')
    expect(html).not.toContain('Описание')
    expect(html).not.toContain('select')
  })
})
