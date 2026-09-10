import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import JournalSourceSwitch from './JournalSourceSwitch.vue'

describe('journal source selection', () => {
  it.each([{ sources: [] }, { sources: [{ uuid: 'personal', kind: 'personal' }] }])('hides source controls without a session diary: %j', async ({ sources }) => {
    const html = await renderToString(createSSRApp(JournalSourceSwitch, { sources }))
    expect(html).not.toContain('Источник дневника')
    expect(html).not.toContain('Сессии')
    expect(html).not.toContain('Дневник сессии появится')
  })
  it('shows the switch when a session diary is available', async () => {
    const html = await renderToString(createSSRApp(JournalSourceSwitch, {
      journal: { uuid: 'personal', kind: 'personal' },
      sources: [{ uuid: 'personal', kind: 'personal' }, { uuid: 'campaign', kind: 'session' }],
    }))
    expect(html).toContain('Источник дневника')
    expect(html).toContain('Личный')
    expect(html).toContain('Сессии')
  })
})
