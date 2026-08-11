import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('ui app-header state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resolves only context owned by the current route', () => {
    const store = useUiStore()
    store.setHeaderContext({
      title: 'Кампания',
      chip: { label: 'Активна', color: 'var(--success)' },
    }, 'Session')

    expect(store.resolveHeader('Session', 'Сессия')).toEqual({
      title: 'Кампания',
      chip: { label: 'Активна', color: 'var(--success)' },
    })
    expect(store.resolveHeader('Handbook', 'Справочник')).toEqual({
      title: 'Справочник',
      chip: null,
    })
  })

  it('does not let stale cleanup clear a newer route owner', () => {
    const store = useUiStore()
    store.setHeaderContext({ title: 'Сессии', chip: { label: 3 } }, 'Sessions')
    store.clearHeaderContext('Handbook')

    expect(store.headerOwner).toBe('Sessions')
    expect(store.headerChip).toEqual({ label: '3', color: '' })

    store.clearHeaderContext('Sessions')
    expect(store.resolveHeader('Sessions', 'Сессии')).toEqual({ title: 'Сессии', chip: null })
  })
})
