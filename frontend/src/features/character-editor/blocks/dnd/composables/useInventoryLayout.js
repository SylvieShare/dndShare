import { reactive } from 'vue'
import { useSortable } from '@sylvieshare/share-ui'
import { cloneModel, EQUIPPED_ID } from '../lib/itemSection'
import { inventorySpaceEntries, moveInventoryCell } from '../lib/inventorySpaces'

export function inventoryItems(model, id) {
  return id === EQUIPPED_ID ? model.equipped : model.sections.find(section => section.id === id)?.items
}
export function setInventoryItems(model, id, items) {
  if (id === EQUIPPED_ID) model.equipped = items
  else {
    const section = model.sections.find(section => section.id === id)
    if (section) section.items = items
  }
}

export function useInventoryLayout({ model, canDrag, entryWithDisplay, emitModel, hideTooltip }) {
  const sectionGroup = id => `sec_${id}`
  const parseGroup = group => String(group).slice(4)
  const sortable = reactive(useSortable({
    groups: new Proxy({}, {
      get(_, group) {
        const id = parseGroup(group)
        if (!inventoryItems(model.value, id)) return undefined
        return {
          layout: 'grid',
          items: { get value() { return inventorySpaceEntries(model.value, id).map(entryWithDisplay) } },
          accepts: () => canDrag.value,
        }
      },
    }),
    getKey: entry => entry.uid,
    onDrop({ item, fromGroup, toGroup, toIndex }) {
      if (!canDrag.value) return
      const fromId = parseGroup(fromGroup), toId = parseGroup(toGroup)
      const next = cloneModel(model.value)
      if (moveInventoryCell(next, { uid: item.uid, fromId, toId, toSlot: toIndex })) emitModel(next)
    },
  }))
  function onRowDown(event, entry, id, index) {
    if (event.target.closest('button, input, a')) return
    if (!canDrag.value) return
    hideTooltip()
    sortable.startDrag(event, entry, sectionGroup(id), index)
  }
  return { sortable, sectionGroup, onRowDown }
}
