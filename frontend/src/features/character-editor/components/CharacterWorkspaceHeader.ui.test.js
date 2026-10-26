import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import CharacterWorkspaceHeader from './CharacterWorkspaceHeader.vue'

async function render(props) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/:pathMatch(.*)*', component: { render: () => null } },
  ] })
  await router.push('/char/hero')
  const app = createSSRApp({ render: () => h(CharacterWorkspaceHeader, props) })
  app.use(router)
  return renderToString(app)
}

const transfers = {
  state: { playersLoaded: true, transfers: [{ id: 1 }], view: 'events' },
  recipients: [{ charUuid: 'other' }],
  interactions: { state: { pending: [{ id: 2 }] } },
  incomingCount: 2,
}

describe('character workspace header', () => {
  it('keeps a named exit available on a sheet without a session', async () => {
    const html = await render({ name: 'Лиора', subtitle: 'Эльф · Бард 3', transfers })
    expect(html).toContain('К списку персонажей')
    expect(html).toContain('Лиора')
    expect(html).toContain('Эльф · Бард 3')
    expect(html).not.toContain('data-tutorial="character-session"')
  })

  it('shows the chapter and live player/event counts next to the session link', async () => {
    const html = await render({ name: 'Лиора', transfers,
      session: { uuid: 'campaign', name: 'Тайны долины', chapterNumber: 3, chapterName: 'Забытый храм' },
    })
    expect(html).toContain('href="/sessions/campaign"')
    expect(html).toContain('Гл. 3 · Забытый храм')
    expect(html).toContain('Игроки: 1')
    expect(html).toContain('События: 2. Входящих: 2')
    expect(html).toContain('campaign-icon--notify')
  })

  it('uses a neutral subtitle when the session has no current chapter', async () => {
    const html = await render({ transfers, session: { uuid: 'campaign', name: 'Тайны долины' } })
    expect(html).toContain('Игровая сессия')
    expect(html).not.toContain('Гл.')
  })
})
