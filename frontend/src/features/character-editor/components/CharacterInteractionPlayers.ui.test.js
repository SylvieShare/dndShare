import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useTemplateStore } from '@/stores/template'
import CharacterInteractionPlayers from './CharacterInteractionPlayers.vue'

async function render(hp) {
  const pinia = createPinia()
  useTemplateStore(pinia).templates = [{ id: 1, name: 'DND5' }]
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/')
  const player = { charUuid: 'peer', templateId: 1, iconImageUrl: '/player.png', data: { values: {
    name: 'Торин', race: { name: 'Дварф' }, classes: [{ name: 'Воин' }], ...(hp ? { hp } : {}),
  } } }
  const app = createSSRApp({ render: () => h(CharacterInteractionPlayers, { players: [player], controller: {}, money: {} }) })
  app.use(pinia).use(router)
  return renderToString(app)
}
describe('other players in the character session block', () => {
  it('shows a 48px icon and a shared HP bar without race, class or ellipsis', async () => {
    const html = await render({ current: 5, max: { base: 20 }, temp: 3 })
    expect(html).toContain('--person-size:48px')
    expect(html).toContain('/player.png')
    expect(html).toContain('Торин')
    expect(html).toContain('role="meter"')
    expect(html).toContain('aria-valuenow="25"')
    expect(html).toContain('+3')
    expect(html).not.toContain('Дварф')
    expect(html).not.toContain('Воин')
    expect(html).not.toContain('lucide-ellipsis')
  })
  it('hides HP when the server does not supply it', async () => {
    const html = await render(null)
    expect(html).not.toContain('role="meter"')
    expect(html).not.toContain('hp-row')
  })
})
