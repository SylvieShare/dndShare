import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionEntityNavigationHistory } from './useSessionEntityNavigationHistory'

describe('useSessionEntityNavigationHistory', () => {
  beforeEach(() => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    })
  })

  it('keeps only ten latest relation transitions and restores them', () => {
    const navigation = useSessionEntityNavigationHistory('session-a')
    for (let id = 1; id <= 12; id += 1) navigation.push({ type: 'location', id, title: `Место ${id}` })
    expect(navigation.history.value).toHaveLength(10)
    expect(navigation.history.value[0].id).toBe(3)
    expect(navigation.backTarget.value.title).toBe('Место 12')
    expect(useSessionEntityNavigationHistory('session-a').history.value).toEqual(navigation.history.value)
  })

  it('pops backwards and ignores duplicate or invalid entries', () => {
    const navigation = useSessionEntityNavigationHistory('session-b')
    navigation.push({ type: 'npc', id: 7, title: 'Мара' })
    navigation.push({ type: 'npc', id: 7, title: 'Мара' })
    navigation.push({ type: 'scene', id: 2, title: 'Сцена' })
    expect(navigation.history.value).toHaveLength(1)
    expect(navigation.pop()).toEqual({ type: 'npc', id: 7, title: 'Мара' })
    expect(navigation.backTarget.value).toBeNull()
  })
})
