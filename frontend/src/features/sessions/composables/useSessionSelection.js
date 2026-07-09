import { ref } from 'vue'
import { kickParticipant as apiKick } from '@/shared/api/sessionsApi'

export function useSessionSelection({ sessionUuid, participants, forgetVersion }) {
  const selectedIds = ref(new Set())
  const selectionMode = ref(false)

  function enterSelectionMode() {
    selectionMode.value = true
    selectAll()
  }

  function exitSelectionMode() {
    selectionMode.value = false
    clearSelection()
  }

  function toggleSelect(charId) {
    const next = new Set(selectedIds.value)
    if (next.has(charId)) next.delete(charId)
    else next.add(charId)
    selectedIds.value = next
  }

  function selectAll() {
    selectedIds.value = new Set(participants.value.map(p => p.charId))
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  async function kickSelected() {
    const ids = [...selectedIds.value]
    for (const charId of ids) {
      await apiKick(sessionUuid, charId).catch(() => {})
      participants.value = participants.value.filter(p => p.charId !== charId)
      forgetVersion?.(charId)
    }
    exitSelectionMode()
  }

  function firstSelectedParticipant() {
    const charId = [...selectedIds.value][0]
    return participants.value.find(x => x.charId === charId) || null
  }

  return {
    selectedIds,
    selectionMode,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelect,
    selectAll,
    clearSelection,
    kickSelected,
    firstSelectedParticipant,
  }
}
