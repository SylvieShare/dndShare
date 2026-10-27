import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defaultTabIndex, parseTabQuery, queryForTab } from './tabQuery'
import definition from '../settings/dnd/definition'

const tabs = definition.tabs.phone

describe('character tab query', () => {
  it('uses section identities across all three compositions', () => {
    for (const format of ['phone', 'tablet', 'desktop']) {
      const list = definition.tabs[format]
      expect(list[parseTabQuery('spells', list)].id).toBe('spells')
    }
    for (const invalid of ['-1', '4', 'unknown', '', undefined]) {
      expect(parseTabQuery(invalid, tabs, 1)).toBe(1)
    }
    expect(parseTabQuery(['journal'], tabs)).toBe(7)
  })
  it('keeps unrelated query values and omits the default tab', () => {
    expect(queryForTab({ mode: 'compact', tab: 'journal' }, 0, 0, tabs)).toEqual({ mode: 'compact' })
    expect(queryForTab({ mode: 'compact' }, 3, 0, tabs)).toEqual({ mode: 'compact', tab: 'spells' })
    expect(defaultTabIndex([{ default: false }, { default: true }])).toBe(1)
  })
  it('restores sections through router Back and Forward', async () => {
    const router = createRouter({ history: createMemoryHistory(),
      routes: [{ path: '/char/:uuid', component: { template: '<div />' } }] })
    await router.push('/char/test?tab=weapons')
    await router.push('/char/test?tab=journal')
    expect(parseTabQuery(router.currentRoute.value.query.tab, tabs)).toBe(7)
    router.back()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseTabQuery(router.currentRoute.value.query.tab, tabs)).toBe(2)
    router.forward()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseTabQuery(router.currentRoute.value.query.tab, tabs)).toBe(7)
  })
})
