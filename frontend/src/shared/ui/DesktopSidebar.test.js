import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { renderComponent } from '../../../tests/unit/renderComponent'
import { useAccountStore } from '@/stores/account'
import DesktopSidebar from './DesktopSidebar.vue'
import { clickOutside } from '@/shared/lib/clickOutside'

// Browser-only popovers are exercised by app-shell.spec.js; this render checks navigation composition.
vi.mock('@/shared/ui/GameContextSelector.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/auth/components/UserBox', () => ({ default: { render: () => null } }))
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn(async () => ({ sessions: [] })) }))

async function renderSidebar(mode, authenticated = false) {
  const pinia = createPinia()
  const account = useAccountStore(pinia)
  account.status = authenticated ? 'success' : 'none'
  account.user = { id: authenticated ? 1 : 0, login: 'tester', roles: [], hasCharacters: authenticated }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/:pathMatch(.*)*', component: { render: () => null } },
  ] })
  await router.push('/handbook')
  return renderComponent(DesktopSidebar, { mode }, { plugins: [pinia, router, { install: app => app.directive('click-outside', clickOutside) }] })
}

describe('shared navigation across window formats', () => {
  it('shows the expanded desktop menu and guest actions', async () => {
    const html = await renderSidebar('desktop')
    expect(html).toContain('app-sidebar--expanded')
    expect(html).toContain('/brand-mark.webp')
    expect(html).toContain('Поиск по справочнику')
    expect(html).toContain('Создать персонажа')
    expect(html).not.toContain('href="/maps"')
  })
  it('keeps the tablet rail collapsed with a drawer action', async () => {
    const html = await renderSidebar('rail', true)
    expect(html).not.toContain('app-sidebar--expanded')
    expect(html).toContain('aria-label="Открыть меню"')
    expect(html).toContain('href="/chars"')
    expect(html).toContain('href="/maps"')
    expect(html).not.toContain('Раскрыть панель')
  })
  it('embeds the same navigation in the expanded drawer', async () => {
    const html = await renderSidebar('drawer', true)
    expect(html).toContain('share-app-sidebar--embedded')
    expect(html).toContain('aria-label="Закрыть меню"')
    expect(html).toContain('Для игрока')
    expect(html).toContain('Для мастера')
    expect(html).toContain('href="/chars"')
    expect(html).not.toContain('Админка')
  })
})
