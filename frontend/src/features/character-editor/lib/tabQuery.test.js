import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defaultTabIndex, parseTabQuery, queryForTab } from './tabQuery'

describe('character tab query', () => {
  it('parses valid tabs and falls back for invalid values', () => {
    expect(parseTabQuery('2', 4, 1)).toBe(2)
    expect(parseTabQuery(['3'], 4, 1)).toBe(3)
    expect(parseTabQuery('-1', 4, 1)).toBe(1)
    expect(parseTabQuery('4', 4, 1)).toBe(1)
    expect(parseTabQuery('2x', 4, 1)).toBe(1)
  })

  it('keeps unrelated query values and omits the default tab', () => {
    expect(queryForTab({ mode: 'compact', tab: '3' }, 0, 0)).toEqual({ mode: 'compact' })
    expect(queryForTab({ mode: 'compact' }, 2, 0)).toEqual({ mode: 'compact', tab: '2' })
    expect(defaultTabIndex([{ default: false }, { default: true }])).toBe(1)
  })

  it('restores tabs through router Back and Forward navigation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/char/:uuid', component: { template: '<div />' } }],
    })
    await router.push('/char/test?tab=1')
    await router.push('/char/test?tab=3')
    expect(parseTabQuery(router.currentRoute.value.query.tab, 4)).toBe(3)

    router.back()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseTabQuery(router.currentRoute.value.query.tab, 4)).toBe(1)

    router.forward()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseTabQuery(router.currentRoute.value.query.tab, 4)).toBe(3)
  })
})
