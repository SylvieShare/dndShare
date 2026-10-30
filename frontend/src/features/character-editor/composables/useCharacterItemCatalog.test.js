import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { itemsApi } from '@/shared/api/itemsApi'
import { useCharacterResources } from './useCharacterResources'
import { useCharacterItemCatalog } from './useCharacterItemCatalog'
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn() } }))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

describe('open character item catalogue', () => {
  it('shares cached records and concurrent requests across responsive block mounts', async () => {
    const first = deferred()
    itemsApi.byIds.mockReset().mockReturnValueOnce(first.promise).mockResolvedValue({ items: [{ id: 2, name: 'Второй' }] })
    const scope = effectScope()
    const resources = scope.run(() => useCharacterResources(ref({}), []))
    const owner = { characterResources: resources }
    const a = useCharacterItemCatalog(owner)
    const initial = a.load([1])
    const b = useCharacterItemCatalog(owner)
    const concurrent = [a.load([2]), b.load([2])]
    first.resolve({ items: [{ id: 1, name: 'Первый' }] })
    await initial; await Promise.all(concurrent); await nextTick()
    expect(itemsApi.byIds).toHaveBeenCalledTimes(2)
    expect(useCharacterItemCatalog(owner).snapshot()[1].name).toBe('Первый')
    await useCharacterItemCatalog(owner).load([1, 2])
    expect(itemsApi.byIds).toHaveBeenCalledTimes(2)
    const other = scope.run(() => useCharacterResources(ref({}), []))
    expect(useCharacterItemCatalog({ characterResources: other }).snapshot()).toEqual({})
    scope.stop()
  })
  it('allows retry after a network failure and accepts explicitly refreshed records', async () => {
    itemsApi.byIds.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [{ id: 1, name: 'Получен' }] })
    const scope = effectScope(), resources = scope.run(() => useCharacterResources(ref({}), []))
    const api = useCharacterItemCatalog({ characterResources: resources })
    expect((await api.load([1])).items).toEqual([])
    await api.load([1]); expect(api.snapshot()[1].name).toBe('Получен')
    api.remember([{ id: 1, name: 'Изменён' }]); expect(api.snapshot()[1].name).toBe('Изменён')
    scope.stop()
  })
})
