import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { innerTabQueryKey, parseInnerTabQuery, queryForInnerTab } from './innerTabQuery'

function innerTabs(title, id, props = {}) {
  return {
    type: 'INNER_TABS',
    props,
    tabs: [{ title, block: { type: 'INPUT_TEXT', id } }],
  }
}

describe('inner character tab query', () => {
  it('uses stable, distinct keys for separate tab groups', () => {
    const weapons = innerTabs('Оружие', 'weapon')
    const diary = innerTabs('Дневник', 'diary')

    expect(innerTabQueryKey(weapons)).toBe(innerTabQueryKey(structuredClone(weapons)))
    expect(innerTabQueryKey(weapons)).not.toBe(innerTabQueryKey(diary))
  })

  it('allows identical groups to declare separate stable identities', () => {
    const first = innerTabs('Общее', 'notes', { queryKey: 'left-notes' })
    const second = innerTabs('Общее', 'notes', { queryKey: 'right-notes' })

    expect(innerTabQueryKey(first)).not.toBe(innerTabQueryKey(second))
  })

  it('parses valid values and safely falls back for invalid or stale values', () => {
    expect(parseInnerTabQuery('2', 4, 1)).toBe(2)
    expect(parseInnerTabQuery(['3'], 4, 1)).toBe(3)
    expect(parseInnerTabQuery('-1', 4, 1)).toBe(1)
    expect(parseInnerTabQuery('4', 4, 1)).toBe(1)
    expect(parseInnerTabQuery('2x', 4, 1)).toBe(1)
  })

  it('updates only its own key and preserves the main tab and other groups', () => {
    const current = { tab: '3', 'innerTab-first': '1', 'innerTab-second': '2' }

    expect(queryForInnerTab(current, 'innerTab-first', 4)).toEqual({
      tab: '3',
      'innerTab-first': '4',
      'innerTab-second': '2',
    })
    expect(queryForInnerTab(current, 'innerTab-first', 0)).toEqual({
      tab: '3',
      'innerTab-second': '2',
    })
  })

  it('restores the selected inner tab through Back and Forward', async () => {
    const key = innerTabQueryKey(innerTabs('Оружие', 'weapon'))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/char/:uuid', component: { template: '<div />' } }],
    })
    await router.push({ path: '/char/test', query: { tab: '2', [key]: '1' } })
    await router.push({ query: queryForInnerTab(router.currentRoute.value.query, key, 3) })
    expect(parseInnerTabQuery(router.currentRoute.value.query[key], 5)).toBe(3)
    expect(router.currentRoute.value.query.tab).toBe('2')

    router.back()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseInnerTabQuery(router.currentRoute.value.query[key], 5)).toBe(1)

    router.forward()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(parseInnerTabQuery(router.currentRoute.value.query[key], 5)).toBe(3)
  })
})
