import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useSuggestLoading } from './useSuggestLoading'

const store = vi.hoisted(() => ({ loaded: vi.fn(() => false), ensure: vi.fn() }))
vi.mock('@/stores/suggest', () => ({ useSuggestStore: () => store }))
const scopes = []
function use(id) { const scope = effectScope(); scopes.push(scope); return scope.run(() => useSuggestLoading(id)) }
const flush = async () => { await Promise.resolve(); await nextTick() }
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.resetAllMocks(); store.loaded.mockReturnValue(false) })

describe('dictionary request feedback', () => {
  it('keeps loading until completion and supports retry after failure', async () => {
    let reject
    store.ensure.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    const state = use(6)
    expect(state.loading.value).toBe(true)
    reject(new Error('offline')); await flush()
    expect(state.loading.value).toBe(false)
    expect(state.error.value).toBeTruthy()
    store.ensure.mockResolvedValueOnce()
    await state.reload()
    expect(state.error.value).toBe('')
    expect(state.loading.value).toBe(false)
  })
  it('does not replace a newer request with an old failure', async () => {
    let rejectOld, resolveNew
    store.ensure.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve }))
    const id = ref(1), state = use(id)
    id.value = 2; await nextTick()
    rejectOld(new Error('old')); await flush()
    expect(state.loading.value).toBe(true)
    expect(state.error.value).toBe('')
    resolveNew(); await flush()
    expect(state.loading.value).toBe(false)
  })
  it('does not show a network loader for local or cached options', () => {
    expect(use('__local__').loading.value).toBe(false)
    store.loaded.mockReturnValue(true)
    expect(use(6).loading.value).toBe(false)
    expect(store.ensure).not.toHaveBeenCalled()
  })
})
