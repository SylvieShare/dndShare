import { useInventoryTooltip } from '@/features/inventory/composables/useInventoryTooltip'
import { EQUIPPED_ID } from '../lib/itemSection'

export function useInventoryRowActions({ model, modalSelection, charCtx, increment, decrement, openInlineForm, removeEntry }) {
  const { tooltip, showTooltip: showDisplayTooltip, hideTooltip } = useInventoryTooltip()
  function viewEntry(entry, close) {
    modalSelection.value = { ...entry, sectionId: findSectionOfEntry(entry.uid) }
    close()
  }

  function deleteOneEntry(sectionId, entry, close) {
    decrement(sectionId, entry.uid)
    close()
  }

  function addEntry(sectionId, entry, close) {
    const remaining = increment(sectionId, entry.uid)
    if (remaining != null) charCtx.logSessionEvent?.({
      type: 'item_added',
      action: `Добавлено: ${entry.display.name}`,
      data: { source: { itemId: entry.magic_item_id ?? entry.item_id, name: entry.display.name }, itemId: entry.magic_item_id ?? entry.item_id ?? null, remaining },
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

  function showTooltip(event, entry) { showDisplayTooltip(event, entry.display) }

  return { tooltip, showTooltip, hideTooltip, viewEntry, deleteOneEntry, addEntry, editEntry, deleteEntry }
}
