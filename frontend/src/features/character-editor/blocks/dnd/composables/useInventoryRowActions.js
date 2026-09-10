import { reactive } from 'vue'
import { EQUIPPED_ID } from '../lib/itemSection'

export function useInventoryRowActions({ model, modalSelection, charCtx, increment, decrement, openInlineForm, removeEntry }) {
  const tooltip = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
  function viewEntry(entry, close) {
    modalSelection.value = { sectionId: findSectionOfEntry(entry.uid), uid: entry.uid, item_id: entry.item_id }
    close()
  }

  function deleteOneEntry(sectionId, entry, close) {
    decrement(sectionId, entry.uid)
    close()
  }

  function addEntry(sectionId, entry, close) {
    const remaining = increment(sectionId, entry.uid)
    charCtx.logSessionEvent?.({
      type: 'item_added',
      action: `Добавлено: ${entry.display.name}`,
      data: { itemId: entry.item_id || null, remaining },
    })
    close()
  }

  function editEntry(sectionId, entry, close) {
    openInlineForm(sectionId, entry)
    close()
  }

  function deleteEntry(sectionId, entry, close) {
    removeEntry(sectionId, entry.uid)
    close()
  }

  function findSectionOfEntry(uid) {
    if (model.value.equipped.some(i => i.uid === uid)) return EQUIPPED_ID
    for (const s of model.value.sections) {
      if (s.items.some(i => i.uid === uid)) return s.id
    }
    return model.value.sections[0]?.id || null
  }

  function showTooltip(e, entry) {
    const d = entry.display
    if (!d.desc && !d.cost && d.weight == null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const above = window.innerHeight - rect.bottom < 150
    const detailItem = d.base
      ? { ...d.base, data: { ...(d.base.data || {}), cost: d.cost || null, weight: d.weight } }
      : (d.isCustom ? { name: d.name, data: { desc: d.desc, consumable: d.consumable } } : null)
    Object.assign(tooltip, {
      visible: true, name: d.name, desc: d.desc,
      item: detailItem,
      x: Math.min(rect.left, window.innerWidth - 320),
      top: above ? null : rect.bottom + 6,
      bottom: above ? window.innerHeight - rect.top + 6 : null,
    })
  }
  function hideTooltip() { tooltip.visible = false }

  return { tooltip, showTooltip, hideTooltip, viewEntry, deleteOneEntry, addEntry, editEntry, deleteEntry }
}
