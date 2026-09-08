import { onBeforeUnmount, ref, watch } from 'vue'

// Drafts are plain journal DTOs. Polls may update the display, never this draft.
export function useJournalInlineEdit(props, emit) {
  const editor = ref(null)
  const error = ref('')
  const saving = ref(false)
  function start(kind, value, isNew = false) {
    if (!props.editable || props.busy || props.locked || editor.value) return
    editor.value = { kind, value: JSON.parse(JSON.stringify(value)), isNew, version: props.event.changedAt }
    error.value = ''
    emit('editing', true)
  }
  function cancel() {
    if (saving.value) return
    editor.value = null
    error.value = ''
    emit('editing', false)
  }
  async function submit(patch) {
    if (!editor.value || saving.value || props.busy || !props.editable) return
    saving.value = true
    error.value = ''
    try {
      await props.saveEvent({ ...props.event, ...patch, expectedChangedAt: editor.value.version })
      saving.value = false
      cancel()
    } catch (reason) {
      error.value = reason?.message || 'Не удалось сохранить. Ваша правка осталась в поле.'
    } finally { saving.value = false }
  }
  watch(() => props.editable, allowed => { if (!allowed) { editor.value = null; emit('editing', false) } })
  onBeforeUnmount(() => emit('editing', false))
  return { editor, error, saving, start, cancel, submit }
}
