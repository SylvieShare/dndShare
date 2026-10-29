import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useInventoryCatalog } from './useInventoryCatalog'
import { itemsApi } from '@/shared/api/itemsApi'
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn() } }))
const model = ids => ({ sections: [{ id: 'bag', items: ids.map(id => ({ uid: String(id), item_id: id })) }] })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

describe('independent inventory placeholders', () => {
  it('keeps loaded items usable while new references wait, and settles a failed request', async () => {
    const first = deferred(), later = deferred()
    itemsApi.byIds.mockReset().mockReturnValueOnce(first.promise).mockReturnValueOnce(later.promise)
    const value = ref(model([1])); const scope = effectScope()
    const api = scope.run(() => useInventoryCatalog(() => value.value))
    expect(api.itemLoading({ item_id: 1 })).toBe(true)
    first.resolve({ items: [{ id: 1, name: 'Готовый предмет' }] }); await first.promise; await nextTick()
    expect(api.catalog[1].name).toBe('Готовый предмет')
    value.value = model([1, 2]); await nextTick()
    expect(api.itemLoading({ item_id: 1 })).toBe(false)
    expect(api.itemLoading({ item_id: 2 })).toBe(true)
    later.reject(new Error('offline')); await Promise.resolve(); await nextTick()
    expect(api.itemLoading({ item_id: 2 })).toBe(false)
    expect(api.error.value).toContain('Не удалось')
    expect(api.catalog[1].name).toBe('Готовый предмет')
    scope.stop()
  })
})
