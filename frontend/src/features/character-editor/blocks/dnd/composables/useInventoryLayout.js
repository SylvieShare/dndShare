import { reactive } from 'vue'
import { useSortable } from '@sylvieshare/share-ui'
import { cloneModel, EQUIPPED_ID } from '../lib/itemSection'
import { moveBagEntry } from '@/features/inventory/lib/bagSlots'

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
  const modes = reactive({})
  const sectionGroup = id => `sec_${id}`
  const parseGroup = group => String(group).slice(4)
  function sectionMode(id) {
    if (id === EQUIPPED_ID) return 'list'
    if (modes[id]) return modes[id]
    try { return localStorage.getItem(`inventory-view:${id}`) === 'list' ? 'list' : 'bag' }
    catch { return 'bag' }
  }
  function setSectionMode(id, mode) {
    if (id === EQUIPPED_ID) return
    modes[id] = mode === 'list' ? 'list' : 'bag'
    try { localStorage.setItem(`inventory-view:${id}`, modes[id]) } catch { /* Optional view preference. */ }
  }
  const sortable = reactive(useSortable({
    groups: new Proxy({}, {
      get(_, group) {
        const id = parseGroup(group)
        if (!inventoryItems(model.value, id)) return undefined
        return {
          layout: sectionMode(id) === 'bag' ? 'grid' : 'list',
          items: { get value() { return inventoryItems(model.value, id).map(entryWithDisplay) } },
          accepts: () => canDrag.value,
        }
      },
    }),
    getKey: entry => entry.uid,
    onDrop({ item, fromGroup, toGroup, toIndex }) {
      if (!canDrag.value) return
      const fromId = parseGroup(fromGroup), toId = parseGroup(toGroup)
      const next = cloneModel(model.value)
      if (sectionMode(toId) === 'bag') {
        if (moveBagEntry(next, { uid: item.uid, fromId, toId, toSlot: toIndex })) emitModel(next)
        return
      }
      const source = inventoryItems(next, fromId), target = inventoryItems(next, toId)
      const index = source?.findIndex(entry => entry.uid === item.uid) ?? -1
      if (index < 0 || !target) return
      const [moved] = source.splice(index, 1)
      target.splice(Math.min(toIndex, target.length), 0, moved)
      const from = next.sections.find(section => section.id === fromId)
      if (from) delete from.slots?.[item.uid]
      const to = next.sections.find(section => section.id === toId)
      if (to) to.slots = Object.fromEntries(target.map((entry, slot) => [entry.uid, slot]))
      emitModel(next)
    },
  }))
  function onRowDown(event, entry, id, index) {
    if (event.target.closest('button, input, a')) return
    if (!canDrag.value) return
    hideTooltip()
    sortable.startDrag(event, entry, sectionGroup(id), index)
  }
  function displaySectionItems(id) { return sortable.displayItems(sectionGroup(id)).map(entryWithDisplay) }
  return { sortable, sectionGroup, sectionMode, setSectionMode, onRowDown, displaySectionItems }
}
