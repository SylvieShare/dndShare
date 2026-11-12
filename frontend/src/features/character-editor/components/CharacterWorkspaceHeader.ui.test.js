import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import CharacterWorkspaceHeader from './CharacterWorkspaceHeader.vue'

// Block mechanics are covered by the real sheet integration tests.
vi.mock('./CharacterBlock.vue', () => ({ default: { render: () => null } }))

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

  it('keeps the session button, current chapter title and incoming event badge', async () => {
    const html = await render({ name: 'Лиора', transfers,
      session: { uuid: 'campaign', name: 'Тайны долины', chapterNumber: 3, chapterName: 'Забытый храм' },
    })
    expect(html).toContain('aria-label="Сессия"')
    expect(html).toContain('Гл. 3 · Забытый храм')
    expect(html).toContain('session-count--incoming')
    expect(html).toContain('>2</span>')
    expect(html).toContain('aria-expanded="false"')
  })

  it('uses a neutral subtitle when the session has no current chapter', async () => {
    const html = await render({ transfers, session: { uuid: 'campaign', name: 'Тайны долины' } })
    expect(html).toContain('title="Тайны долины"')
    expect(html).not.toContain('Гл.')
  })
})
