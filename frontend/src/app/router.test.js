import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Exercise the application guards without browser history or page loading.
vi.mock('vue-router', async importOriginal => {
  const original = await importOriginal()
  return {
    ...original,
    createWebHistory: original.createMemoryHistory,
    createRouter: options => original.createRouter({
      ...options,
      routes: options.routes.map(route => ({
        ...route,
        component: route.component ? { render: () => null } : undefined,
        meta: { ...route.meta, prefetch: undefined },
      })),
    }),
  }
})

let router

beforeEach(async () => {
  vi.resetModules()
  router = (await import('./router')).router
  vi.stubGlobal('document', { title: '' })
})

async function openCharacter() {
  await router.push('/char/hero')
  expect(document.title).toBe('Персонаж')
  document.title = 'Лиора'
}

afterEach(() => vi.unstubAllGlobals())

describe('page titles during navigation', () => {
  it('sets the title on the first navigation to the homepage', async () => {
    await router.push('/')
    expect(document.title).toBe('Главная')
  })

  it('keeps the character name across outer and inner tabs and history', async () => {
    await openCharacter()
    await router.push('/char/hero?tab=1')
    expect(document.title).toBe('Лиора')
    await router.push('/char/hero?tab=1&innerTab-main=2')
    expect(document.title).toBe('Лиора')
    await router.push('/char/hero?tab=2#magic')
    expect(document.title).toBe('Лиора')

    const navigateHistory = delta => new Promise(resolve => {
      const removeHook = router.afterEach(() => {
        removeHook()
        resolve()
      })
      router.go(delta)
    })
    await navigateHistory(-1)
    expect(router.currentRoute.value.query.tab).toBe('1')
    expect(document.title).toBe('Лиора')
    await navigateHistory(1)
    expect(router.currentRoute.value.query.tab).toBe('2')
    expect(document.title).toBe('Лиора')
  })

  it('sets the route title when leaving the sheet or opening another character', async () => {
    await openCharacter()
    await router.push('/chars')
    expect(document.title).toBe('Персонажи')
    await router.push('/char/other')
    expect(document.title).toBe('Персонаж')
    await router.push('/char/other/print')
    expect(document.title).toBe('Печатный лист персонажа')
  })

  it('keeps the current title when navigation is cancelled', async () => {
    await openCharacter()
    const removeGuard = router.beforeEach(to => to.path === '/chars' ? false : undefined)
    try {
      await router.push('/chars')
      expect(router.currentRoute.value.path).toBe('/char/hero')
      expect(document.title).toBe('Лиора')
    } finally {
      removeGuard()
    }
  })
})
