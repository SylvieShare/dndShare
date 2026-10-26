import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { renderComponent } from '../../../tests/unit/renderComponent'
import { useGameContextStore } from '@/stores/gameContext'
import AppHeader from './AppHeader.vue'

vi.mock('@/shared/composables/useAppLayout', async () => {
  const { ref } = await import('vue')
  return { useAppLayout: () => ({ phone: ref(true), compact: ref(true) }) }
})

async function renderHeader(path = '/handbook', props = {}) {
  const pinia = createPinia()
  const context = useGameContextStore(pinia)
  context.sources = [{ id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }]
  context.sourceVersionId = 1
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/handbook', name: 'Handbook', component: { render: () => null }, meta: { title: 'Справочник', section: 'handbook' } },
    { path: '/account', name: 'Account', component: { render: () => null }, meta: { title: 'Аккаунт', mobileBackTo: { name: 'Handbook' } } },
  ] })
  await router.push(path)
  return renderComponent(AppHeader, props, { plugins: [pinia, router] })
}

describe('app header', () => {
  it('shows the page and game context with a drawer trigger', async () => {
    const html = await renderHeader('/handbook', { menuOpen: true })
    expect(html).toContain('Справочник')
    expect(html).toContain('D&amp;D 5e · 2014')
    expect(html).toContain('aria-label="Открыть меню"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toContain('brand-menu')
    expect(html).not.toContain('Обновить')
  })
  it('retains a semantic parent action on a nested page', async () => {
    const html = await renderHeader('/account')
    expect(html).toContain('Аккаунт')
    expect(html).toContain('aria-label="Назад"')
  })
})
