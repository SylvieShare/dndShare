import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { entryDisplayData, normalizeValue } from '../lib/itemSection'
import { normalizeInventorySpaces } from '../lib/inventorySpaces'
import { useInventoryRemoval } from './useInventoryRemoval'

function setup(entries = [{ uid: 'torch', item_id: 42, count: 3 }], equipped = []) {
  const catalog = { 42: { id: 42, name: 'Факел', data: {} },
    49: { id: 49, name: 'Меч', typeId: 1, data: {} },
    100: { id: 100, name: 'Магический меч', typeId: 19, data: { weapon: { base_item_id: 49 } } },
  }
  const model = ref(normalizeValue({ equipped, sections: [
    { id: 'bag', name: 'Рюкзак', items: entries },
    { id: 'other', name: 'Сумка', items: [{ uid: 'rope', item_id: 43, count: 1 }] },
  ] }))
  const emitModel = vi.fn(next => { model.value = normalizeInventorySpaces(next) })
  const charCtx = { logSessionEvent: vi.fn() }
  const actions = useInventoryRemoval({ model, emitModel, charCtx,
    entryWithDisplay: entry => ({ ...entry, display: entryDisplayData(entry, catalog) }),
  })
  return { model, emitModel, log: charCtx.logSessionEvent, actions }
}

describe('inventory removal chronicle', () => {
  it('records single removal and whole-stack deletion with their actual quantities', () => {
    const { model, log, actions } = setup()
    actions.decrement('bag', 'torch')
    expect(model.value.sections[0].items[0].count).toBe(2)
    expect(log).toHaveBeenLastCalledWith({ type: 'item_removed', action: 'Удалено: Факел',
      data: { source: { itemId: 42, name: 'Факел', instanceUid: 'torch' }, itemId: 42, count: 1, remaining: 2 },
    })
    actions.removeEntry('bag', 'torch')
    expect(model.value.sections[0].items).toEqual([])
    expect(log).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ count: 2, remaining: 0 }) }))
    expect(log).toHaveBeenCalledTimes(2)
    expect(model.value.sections[1].items).toHaveLength(1)
  })

  it('removes the last item and skips repeated or missing removals', () => {
    const { model, log, emitModel, actions } = setup([{ uid: 'torch', item_id: 42, count: 1 }])
    actions.decrement('bag', 'torch')
    expect(model.value.sections[0].items).toEqual([])
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ count: 1, remaining: 0 }) }))
    actions.decrement('bag', 'torch')
    actions.removeEntry('bag', 'missing')
    actions.removeEntry('missing', 'torch')
    actions.removeSection('missing')
    expect(log).toHaveBeenCalledOnce()
    expect(emitModel).toHaveBeenCalledOnce()
  })

  it('keeps the custom item name without a handbook ID', () => {
    const { log, actions } = setup([{ uid: 'custom', item_id: null, count: 4, override: { name: 'Ключ от башни' } }])
    actions.removeEntry('bag', 'custom')
    expect(log).toHaveBeenCalledWith({ type: 'item_removed', action: 'Удалено: Ключ от башни',
      data: { source: { itemId: null, name: 'Ключ от башни', instanceUid: 'custom' }, itemId: null, count: 4, remaining: 0 },
    })
  })

  it('records the magic item as the source when deleting equipped equipment', () => {
    const { model, log, actions } = setup([], [{ uid: 'magic', item_id: 49, magic_item_id: 100, count: 1 }])
    actions.removeEntry('equipped', 'magic')
    expect(model.value.equipped).toEqual([])
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'Удалено: Магический меч',
      data: expect.objectContaining({ source: { itemId: 100, name: 'Магический меч', instanceUid: 'magic' }, count: 1, remaining: 0 }),
    }))
  })

  it('records every stack and equipped item removed with a section', () => {
    const { model, log, actions } = setup(undefined, [{ uid: 'magic', item_id: 49, magic_item_id: 100, count: 1 }])
    actions.removeSection('bag')
    expect(model.value.sections.map(section => section.id)).toEqual(['other'])
    expect(model.value.sections[0].items[0].uid).toBe('rope')
    expect(model.value.equipped).toEqual([])
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][0].data.removedEntries.map(entry => [entry.source.instanceUid, entry.count, entry.remaining]))
      .toEqual([['torch', 3, 0], ['magic', 1, 0]])
    actions.removeSection('other')
    expect(model.value.sections).toHaveLength(1)
    expect(model.value.sections[0]).toMatchObject({ name: 'Рюкзак', items: [] })
  })

  it('keeps a large section deletion within one atomic-save event', () => {
    const { log, actions } = setup(Array.from({ length: 60 }, (_, i) => ({ uid: `torch-${i}`, item_id: 42, count: 3 })))
    actions.removeSection('bag')
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][0].data.removedEntries).toHaveLength(60)
  })

  it('does not publish an inventory event when removing an empty section', () => {
    const { log, emitModel, actions } = setup([])
    actions.removeSection('bag')
    expect(emitModel).toHaveBeenCalledOnce()
    expect(log).not.toHaveBeenCalled()
  })
})
