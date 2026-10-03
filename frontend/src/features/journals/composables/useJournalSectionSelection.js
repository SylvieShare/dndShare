import { computed, ref, watch } from 'vue'
import { localDate } from '@/features/sessions/lib/sessionOccurrences'

function initialSection(sections) {
  if (!sections.some(section => section.occurrenceId)) return sections.at(-1)
  const dated = sections.filter(section => section.date).sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)
  return dated.find(section => section.date === localDate()) || dated.filter(section => section.date < localDate()).at(-1) || dated[0] || sections.at(-1)
}

export function useJournalSectionSelection(journal) {
  const selectedId = ref('')
  const remembered = new Map()
  watch([() => journal.value?.uuid, () => (journal.value?.sections || []).map(section => section.id).join(',')], () => {
    const root = journal.value
    const sections = root?.sections || []
    const candidate = remembered.get(root?.uuid)
    selectedId.value = sections.find(section => section.id === candidate)?.id || initialSection(sections)?.id || ''
    if (root?.uuid && selectedId.value) remembered.set(root.uuid, selectedId.value)
  }, { immediate: true, flush: 'sync' })
  watch(selectedId, id => { if (journal.value?.uuid && id) remembered.set(journal.value.uuid, id) }, { flush: 'sync' })
  const selectedSection = computed(() => journal.value?.sections.find(section => section.id === selectedId.value) || null)
  return { selectedId, selectedSection }
}
