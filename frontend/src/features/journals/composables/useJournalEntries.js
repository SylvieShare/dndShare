import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { defaultEvent } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

export function useJournalEntries(workspace, selectedSection) {
  const editingId = ref(''), focusEventId = ref(''), dragging = ref(false), removingEvent = ref(null)
  const locked = computed(() => workspace.busy.value || dragging.value || Boolean(editingId.value))
  function setDragging(value) { dragging.value = value; workspace.setDragging(value) }
  function setEditing(id, editing) {
    if (editing) editingId.value = id
    else if (editingId.value === id) editingId.value = ''
    workspace.setInlineEditing(Boolean(editingId.value))
    if (focusEventId.value === id) focusEventId.value = ''
  }
  async function createEvent(type) {
    if (locked.value || !workspace.canEdit.value || !selectedSection.value) return
    const section = selectedSection.value
    const before = new Set(section.events.map(event => event.id))
    try {
      await workspace.createEntry(section.id, { ...defaultEvent(), type })
      focusEventId.value = selectedSection.value?.events.find(event => !before.has(event.id))?.id || ''
    } catch { /* The workspace keeps the operation error. */ }
  }
  async function removeEvent() {
    try { await workspace.removeEntry(removingEvent.value.id); removingEvent.value = null }
    catch { /* Keep the confirmation and error open for a retry. */ }
  }
  watch(() => workspace.journal.value?.uuid, () => {
    removingEvent.value = null; editingId.value = ''; focusEventId.value = ''
    workspace.setInlineEditing(false)
  })
  watch(workspace.canEdit, allowed => { if (!allowed) removingEvent.value = null })
  function beforeUnload(event) { if (editingId.value) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  return { editingId, focusEventId, dragging, removingEvent, locked, setDragging, setEditing, createEvent, removeEvent }
}
