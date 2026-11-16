import { computed, ref, watch } from 'vue'
import { pvExperiencePath, pvHpPath } from '../lib/participantView'

export function useRosterSelection(encounter, getItems) {
  const selecting = ref(false)
  const items = computed(getItems)
  const selected = computed(() => items.value.filter(row => encounter.isSelected(row)))
  const damageTargets = computed(() => selected.value.filter(row => row.position !== 'dead' &&
    (row.type === 'npc' || pvHpPath(encounter.findParticipant(row.charId)))))
  const experienceTargets = computed(() => selected.value.filter(row => row.type === 'player' && pvExperiencePath(encounter.findParticipant(row.charId))))
  const supportsExperience = computed(() => items.value.some(row => row.type === 'player' && pvExperiencePath(encounter.findParticipant(row.charId))))
  const moveTargets = computed(() => selected.value.filter(row => encounter.willMoveToGroup(row,'combat')))
  function finish() {
    for (const row of items.value) if (encounter.isSelected(row)) encounter.toggleSelected(row)
    selecting.value = false
  }
  function toggle() { if (selecting.value) finish(); else selecting.value = true }
  watch(selected, rows => { if (rows.length) selecting.value = true })
  // Reserve tabs share encounter selection, but leaving a list must not leave
  // invisible targets in its selection mode.
  watch(() => items.value.map(row => row.uid), (ids, previous=[]) => {
    if (!selecting.value) return
    for (const id of previous) if (!ids.includes(id)) encounter.unselect(id)
  })
  return { selecting, items, selected, damageTargets, experienceTargets, supportsExperience, moveTargets, toggle, finish }
}
