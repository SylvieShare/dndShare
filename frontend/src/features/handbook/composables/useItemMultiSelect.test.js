import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { useItemMultiSelect } from './useItemMultiSelect'
import { itemSelectionField, itemSelectionRows } from '../objects/lib/itemSelection'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'

vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn() }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { byIds: vi.fn() } }))
const scopes = []
function setup(ids = []) {
  const props = reactive({ modelValue: ids, itemTypeId: 9 })
  const emit = vi.fn()
  const scope = effectScope()
  scopes.push(scope)
  return { props, emit, select: scope.run(() => useItemMultiSelect(props, emit)) }
}
const flush = async () => { await Promise.resolve(); await nextTick() }
beforeEach(() => {
  vi.useFakeTimers()
  fetchGet.mockResolvedValue({ items: [] })
  itemsApi.byIds.mockResolvedValue({ items: [] })
})
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers(); vi.resetAllMocks() })

describe('item multiselect', () => {
  it('cancels draft edits and commits unique IDs only when applied', () => {
    const { select, emit } = setup([1, '1', 2])
    select.begin()
    select.toggle(1)
    select.toggle(3)
    select.close()
    expect(emit).not.toHaveBeenCalled()
    select.begin()
    expect(select.draft.value).toEqual([1, 2])
    select.toggle(3)
    select.apply()
    expect(emit).toHaveBeenCalledWith('update:modelValue', [1, 2, 3])
  })

  it('retains selection across search and ignores a late earlier response', async () => {
    let resolveOld
    fetchGet.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ items: [{ id: 5, name: 'Бард' }] })
    const { select } = setup([1])
    select.begin()
    select.search.value = 'бард'
    await vi.advanceTimersByTimeAsync(200)
    select.toggle(5)
    resolveOld({ items: [{ id: 4, name: 'Воин' }] })
    await flush()
    expect(select.items.value.map(item => item.id)).toEqual([5])
    expect(select.draft.value).toEqual([1, 5])
    expect(fetchGet).toHaveBeenLastCalledWith('/items/search?q=%D0%B1%D0%B0%D1%80%D0%B4&typeId=9&limit=40&offset=0')
  })

  it('appends pages without losing draft selection', async () => {
    fetchGet.mockResolvedValueOnce({ items: Array.from({ length: 40 }, (_, i) => ({ id: i + 1 })) })
      .mockResolvedValueOnce({ items: [{ id: 41 }] })
    const { select } = setup()
    select.begin()
    await flush()
    select.toggle(3)
    await select.loadMore()
    expect(select.items.value).toHaveLength(41)
    expect(select.draft.value).toEqual([3])
    expect(select.hasMore.value).toBe(false)
    expect(fetchGet).toHaveBeenLastCalledWith('/items?typeId=9&limit=40&offset=40')
  })

  it('keeps a combined selection while switching catalogues and ignores the previous collection response', async () => {
    let resolveOld
    fetchGet.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ items: [{ id: 393, typeId: 14, name: 'Набор для грима' }] })
    const { select, emit } = setup([70])
    select.begin()
    select.selectType(14)
    await flush()
    select.toggle(393)
    resolveOld({ items: [{ id: 1 }] })
    await flush()
    expect(select.items.value.map(i => i.id)).toEqual([393])
    expect(select.draft.value).toEqual([70, 393])
    expect(fetchGet).toHaveBeenLastCalledWith('/items?typeId=14&limit=40&offset=0')
    select.apply()
    expect(emit).toHaveBeenCalledWith('update:modelValue', [70, 393])
  })

  it('preserves unavailable selected IDs after a failed hydration and permits removal', async () => {
    itemsApi.byIds.mockRejectedValue(new Error('offline'))
    const { select, emit } = setup([5, 6])
    await flush()
    expect(select.hydrationError.value).toContain('Выбор сохранён')
    expect(select.selectedItems.value.map(item => item.id)).toEqual([5, 6])
    select.remove(5)
    expect(emit).toHaveBeenCalledWith('update:modelValue', [6])
  })

  it('refreshes a selected row after editing its object', () => {
    const { select } = setup([1])
    select.updateItem({ id: 1, name: 'Новое имя' })
    expect(select.selectedItems.value[0].name).toBe('Новое имя')
  })

  it('reopens on the latest external selection', () => {
    const { props, select } = setup([1])
    select.begin()
    select.close()
    props.modelValue = [2]
    select.begin()
    expect(select.draft.value).toEqual([2])
  })
})

describe('reference array schema adapter', () => {
  it('uses multiselect only for plain item links, retaining structured mechanics editors', () => {
    const id = { key: 'id', type: 'item', item_type: 9 }
    expect(itemSelectionField({ type: 'object_array', fields: [id] })).toBe(id)
    expect(itemSelectionField({ type: 'object_array', fields: [id, { key: 'level', type: 'int' }] })).toBeNull()
    expect(itemSelectionField({ type: 'object', fields: [id] })).toBeNull()
  })
  it('roundtrips stored rows and removes duplicates and invalid identifiers', () => {
    expect(itemSelectionRows([{ id: 1, note: 'keep' }, { id: 2 }], ['1', 1, 3, null, -1, 'bad']))
      .toEqual([{ id: 1, note: 'keep' }, { id: 3 }])
  })
})
