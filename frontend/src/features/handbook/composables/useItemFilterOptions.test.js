import { effectScope, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemFilterOptions } from './useItemFilterOptions'

vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { listAll: vi.fn() } }))
const scopes = []
const fields = [{ path: 'classes.id', filter_item_type: 9 }]
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function settle() { await nextTick(); await Promise.resolve(); await nextTick() }
function setup(overrides = {}) {
  const props = reactive({ filterFields: fields, sourceVersionId: 1, allowLegacy: false, ...overrides })
  const scope = effectScope()
  scopes.push(scope)
  return { props, options: scope.run(() => useItemFilterOptions(props)), scope }
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.resetAllMocks() })

describe('edition-scoped reference filter options', () => {
  it.each([1, 1799])('uses the active edition %s without restricting reference publications', async sourceVersionId => {
    itemsApi.listAll.mockResolvedValue({ items: [{ id: 4021, name: 'Паладин' }] })
    const { options } = setup({ sourceVersionId, contentSourceIds: [15] })
    await settle()
    expect(itemsApi.listAll).toHaveBeenCalledExactlyOnceWith(9, {
      sourceVersionId, contentSources: { allowLegacy: false },
    })
    expect(options.value).toEqual({ 'classes.id': [{ value: 4021, label: 'Паладин' }] })
  })

  it('clears old edition choices and ignores a late response after switching editions', async () => {
    const first = deferred(), second = deferred()
    itemsApi.listAll.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { props, options } = setup()
    props.sourceVersionId = 1799
    await settle()
    expect(options.value).toEqual({})
    second.resolve({ items: [{ id: 6939, name: 'Паладин' }] })
    await settle()
    first.resolve({ items: [{ id: 4021, name: 'Паладин' }] })
    await settle()
    expect(options.value['classes.id']).toEqual([{ value: 6939, label: 'Паладин' }])
  })

  it('removes already loaded variants while a new edition is pending', async () => {
    itemsApi.listAll.mockResolvedValueOnce({ items: [{ id: 4021, name: 'Паладин' }] }).mockReturnValueOnce(new Promise(() => {}))
    const { props, options } = setup()
    await settle()
    expect(options.value['classes.id']).toHaveLength(1)
    props.sourceVersionId = 1799
    await settle()
    expect(options.value).toEqual({})
  })

  it('reloads when the picker permits legacy content and preserves distinct reference IDs', async () => {
    itemsApi.listAll.mockResolvedValue({ items: [{ id: 4021, name: 'Паладин' }, { id: 6939, name: 'Паладин' }] })
    const { props, options } = setup({ sourceVersionId: 1799 })
    await settle()
    props.allowLegacy = true
    await settle()
    expect(itemsApi.listAll).toHaveBeenLastCalledWith(9, { sourceVersionId: 1799, contentSources: { allowLegacy: true } })
    expect(options.value['classes.id'].map(option => option.value)).toEqual([4021, 6939])
  })

  it('shares a catalogue request between fields and keeps successful groups if another request fails', async () => {
    itemsApi.listAll.mockImplementation(async typeId => {
      if (typeId === 17) throw new Error('Unavailable')
      return { items: [{ id: 4021, name: 'Паладин' }] }
    })
    const { options } = setup({ filterFields: [...fields,
      { path: 'class', filter_item_type: 9 }, { path: 'subclass', filter_item_type: 17 },
    ] })
    await settle()
    expect(itemsApi.listAll).toHaveBeenCalledTimes(2)
    expect(options.value.class).toEqual(options.value['classes.id'])
    expect(options.value.subclass).toEqual([])
  })

  it('does not publish results after the consumer is disposed', async () => {
    const response = deferred()
    itemsApi.listAll.mockReturnValue(response.promise)
    const { options, scope } = setup()
    scope.stop()
    response.resolve({ items: [{ id: 4021, name: 'Паладин' }] })
    await settle()
    expect(options.value).toEqual({})
  })
})
