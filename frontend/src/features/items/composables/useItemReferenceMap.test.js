import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemReferenceMap } from './useItemReferenceMap'

const hooks = vi.hoisted(() => ({ unmount: [] }))
vi.mock('vue', async original => ({ ...await original(), onBeforeUnmount: callback => hooks.unmount.push(callback) }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn() } }))
const scopes = []
function setup(ids) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useItemReferenceMap(ids))
}
async function settle() { await Promise.resolve(); await nextTick() }

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => {
  hooks.unmount.splice(0).forEach(callback => callback())
  scopes.splice(0).forEach(scope => scope.stop())
})

describe('shared handbook references', () => {
  it('batches unique ids and preserves both raster and SVG icons', async () => {
    const goblin = { id: 42, name: 'Гоблин', iconImageUrl: '/goblin.png' }
    const wolf = { id: 43, name: 'Волк', svg: '<svg />' }
    itemsApi.byIds.mockResolvedValue({ items: [goblin, wolf] })
    const ids = ref([42, '42', null, 43])
    const state = setup(ids)
    await settle()
    expect(itemsApi.byIds).toHaveBeenCalledExactlyOnceWith(['42', '43'])
    expect(state.itemById(42)).toEqual(goblin)
    expect(state.itemById('43')).toEqual(wolf)
    expect(state.itemById(99)).toBeNull()
    ids.value = [43, 42, 42]
    await settle()
    expect(itemsApi.byIds).toHaveBeenCalledTimes(1)
  })
  it('ignores an older section response arriving after a new section', async () => {
    let resolveOld
    itemsApi.byIds.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ items: [{ id: 2, name: 'Волк' }] })
    const ids = ref([1])
    const state = setup(ids)
    ids.value = [2]
    await settle()
    resolveOld({ items: [{ id: 1, name: 'Гоблин' }] })
    await settle()
    expect(state.itemById(1)).toBeNull()
    expect(state.itemById(2)?.name).toBe('Волк')
  })
  it('clears references without a request for an empty section and ignores pending responses', async () => {
    let resolveRequest
    itemsApi.byIds.mockReturnValue(new Promise(resolve => { resolveRequest = resolve }))
    const ids = ref([1])
    const state = setup(ids)
    ids.value = []
    await settle()
    resolveRequest({ items: [{ id: 1 }] })
    await settle()
    expect(state.itemsById.value.size).toBe(0)
    expect(itemsApi.byIds).toHaveBeenCalledTimes(1)
  })
  it('tolerates unavailable references without rejecting the journal load', async () => {
    itemsApi.byIds.mockRejectedValue(new Error('offline'))
    const state = setup(ref([42]))
    await settle()
    expect(state.itemById(42)).toBeNull()
  })
  it('does not apply responses after unmount', async () => {
    let resolveRequest
    itemsApi.byIds.mockReturnValue(new Promise(resolve => { resolveRequest = resolve }))
    const state = setup(ref([42]))
    hooks.unmount.splice(0).forEach(callback => callback())
    resolveRequest({ items: [{ id: 42 }] })
    await settle()
    expect(state.itemsById.value.size).toBe(0)
  })
})
