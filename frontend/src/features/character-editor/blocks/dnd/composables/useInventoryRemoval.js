import { cloneModel, makeSectionId } from '../lib/itemSection'
import { inventorySpaceEntries } from '../lib/inventorySpaces'
import { inventoryItems, setInventoryItems } from './useInventoryLayout'

export function useInventoryRemoval({ model, emitModel, charCtx, entryWithDisplay }) {
  function removalData(entry, count, remaining) {
    const name = entryWithDisplay(entry).display.name
    const itemId = entry.magic_item_id ?? entry.item_id ?? null
    return { source: { itemId, name, instanceUid: entry.uid }, itemId, count, remaining }
  }

  function logRemoval(entry, count, remaining) {
    const data = removalData(entry, count, remaining)
    charCtx.logSessionEvent?.({
      type: 'item_removed',
      action: `Удалено: ${data.source.name}`,
      data,
    })
  }

  function remove(sectionId, uid, one) {
    const next = cloneModel(model.value)
    const list = inventoryItems(next, sectionId)
    const entry = list?.find(item => item.uid === uid)
    if (!entry) return
    const previous = Math.max(1, Number(entry.count) || 1)
    const count = one ? 1 : previous
    const remaining = previous - count
    if (remaining) entry.count = remaining
    else setInventoryItems(next, sectionId, list.filter(item => item.uid !== uid))
    emitModel(next)
    logRemoval(entry, count, remaining)
  }

  function removeSection(id) {
    const section = model.value.sections.find(section => section.id === id)
    if (!section) return
    const next = cloneModel(model.value)
    const entries = inventorySpaceEntries(next, id)
    const removed = new Set(entries.map(entry => entry.uid))
    next.equipped = next.equipped.filter(entry => !removed.has(entry.uid))
    next.sections = next.sections.filter(section => section.id !== id)
    if (!next.sections.length) next.sections.push({ id: makeSectionId(), name: 'Рюкзак', items: [] })
    emitModel(next)
    if (entries.length) charCtx.logSessionEvent?.({
      type: 'item_removed',
      action: `Удалены предметы секции: ${section.name}`,
      data: { sectionName: section.name, removedEntries: entries.map(entry => removalData(entry, Math.max(1, Number(entry.count) || 1), 0)) },
    })
  }

  return {
    decrement: (sectionId, uid) => remove(sectionId, uid, true),
    removeEntry: (sectionId, uid) => remove(sectionId, uid, false),
    removeSection,
  }
}
