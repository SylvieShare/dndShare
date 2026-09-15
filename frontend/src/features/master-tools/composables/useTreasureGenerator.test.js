import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useTreasureGenerator } from './useTreasureGenerator'
const fetchGet = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/http', () => ({ fetchGet }))
describe('session treasure state', () => {
  it('loads only after activation, preserves results without a view and resets on edition changes', async () => {
    fetchGet.mockResolvedValue({ items: [] })
    const scope = effectScope(), edition = ref(null)
    const state = scope.run(() => useTreasureGenerator(edition))
    expect(fetchGet).not.toHaveBeenCalled()
    edition.value = 1
    await nextTick()
    await Promise.resolve()
    expect(fetchGet).toHaveBeenCalledWith('/master-tools/treasure-pool?sourceVersionId=1')
    state.options.value.count = 0
    state.options.value.goldMin = 12
    state.options.value.goldMax = 12
    state.generate()
    await nextTick()
    expect(state.result.value).toMatchObject({ gold: 12, items: [] })
    expect(state.options.value.count).toBe(0)
    edition.value = 2
    await nextTick()
    expect(state.result.value).toBe(null)
    expect(fetchGet).toHaveBeenLastCalledWith('/master-tools/treasure-pool?sourceVersionId=2')
    scope.stop()
  })
})
