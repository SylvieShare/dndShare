import { computed, ref, watch } from 'vue'

export function useJournalSectionSelection(journal) {
  const selectedId = ref('')
  const remembered = new Map()
  watch([() => journal.value?.uuid, () => (journal.value?.sections || []).map(section => section.id).join(',')], () => {
    const root = journal.value
    const sections = root?.sections || []
    const candidate = remembered.get(root?.uuid)
    selectedId.value = sections.find(section => section.id === candidate)?.id || sections.at(-1)?.id || ''
    if (root?.uuid && selectedId.value) remembered.set(root.uuid, selectedId.value)
  }, { immediate: true, flush: 'sync' })
  watch(selectedId, id => { if (journal.value?.uuid && id) remembered.set(journal.value.uuid, id) }, { flush: 'sync' })
  const selectedSection = computed(() => journal.value?.sections.find(section => section.id === selectedId.value) || null)
  return { selectedId, selectedSection }
}
