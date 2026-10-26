import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { renderComponent } from '../../../../tests/unit/renderComponent'
import { useAuthDialogStore } from '@/stores/authDialog'
import UserBoxFormAuth from './UserBoxFormAuth.vue'
import AppAuthDialogs from './AppAuthDialogs.vue'

// Render the real form contents inline instead of SSR's Teleport placeholder.
vi.mock('@sylvieshare/share-ui', async importOriginal => {
  const actual = await importOriginal()
  const { h, defineComponent } = await import('vue')
  return { ...actual, AppModalFrame: defineComponent({
    props: ['title'],
    setup: (props, { slots }) => () => h('section', { role: 'dialog', 'aria-label': props.title }, [
      slots.default?.(), slots.footer?.(),
    ]),
  }) }
})

describe('shared auth dialog', () => {
  let pinia
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders a labelled login icon in the rail and login/registration buttons when expanded', async () => {
    const compact = await renderComponent(UserBoxFormAuth, { expanded: false }, { plugins: [pinia] })
    expect(compact).toContain('aria-label="Войти"')
    expect(compact).toContain('title="Войти"')
    expect(compact).toContain('<svg')
    expect(compact).not.toContain('Регистрация')
    const expanded = await renderComponent(UserBoxFormAuth, {}, { plugins: [pinia] })
    expect(expanded).toContain('>Войти</span>')
    expect(expanded).toContain('>Регистрация</button>')
  })

  it.each(['create-character', 'clone-character'])('keeps the %s context when switching to registration', reason => {
    const dialog = useAuthDialogStore()
    dialog.openLogin(reason)
    const hint = dialog.hint
    expect(hint).toMatch(/создания персонажа|клонировать персонажа/)
    dialog.openRegistration()
    expect(dialog.view).toBe('registration')
    expect(dialog.hint).toBe(hint)
    dialog.close()
    expect(dialog.view).toBeNull()
    expect(dialog.hint).toBe('')
    dialog.openLogin()
    expect(dialog.hint).toBe('')
  })

  it('renders one login form with two sidebar triggers sharing the controller', async () => {
    useAuthDialogStore().openLogin('create-character')
    const content = { setup: () => () => h('div', [
      h(UserBoxFormAuth, { expanded: false }), h(UserBoxFormAuth), h(AppAuthDialogs),
    ]) }
    const html = await renderComponent(content, {}, { plugins: [pinia] })
    expect(html.match(/role="dialog"/g)).toHaveLength(1)
    expect(html.match(/autocomplete="current-password"/g)).toHaveLength(1)
    expect(html).toContain('Для создания персонажа войдите или зарегистрируйтесь.')
  })

  it('renders registration alone with its existing fields and clone hint', async () => {
    const dialog = useAuthDialogStore()
    dialog.openLogin('clone-character')
    dialog.openRegistration()
    const html = await renderComponent(AppAuthDialogs, {}, { plugins: [pinia] })
    expect(html.match(/role="dialog"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Регистрация"')
    expect(html).toContain('Придумайте логин')
    expect(html.match(/autocomplete="new-password"/g)).toHaveLength(2)
    expect(html).toContain('После входа нажмите «Клонировать себе» снова.')
    expect(html).not.toContain('autocomplete="current-password"')
  })

  it('starts closed with a separate Pinia instance instead of persisting auth UI state', () => {
    useAuthDialogStore().openLogin('create-character')
    const fresh = useAuthDialogStore(createPinia())
    expect(fresh.view).toBeNull()
    expect(fresh.hint).toBe('')
  })
})
