import { computed, ref } from 'vue'

export function useEncounterSelection({ encounter, listForGroup }) {
  const selectedUids = ref(new Set())

  function isSelected(c) {
    return selectedUids.value.has(c.uid)
  }

  function toggleSelected(c) {
    const next = new Set(selectedUids.value)
    if (next.has(c.uid)) next.delete(c.uid)
    else next.add(c.uid)
    selectedUids.value = next
  }

  function clearSelection() {
    selectedUids.value = new Set()
  }

  function selectedCountInGroup(group) {
    return listForGroup(group).reduce(
      (n, c) => n + (selectedUids.value.has(c.uid) ? 1 : 0),
      0,
    )
  }

  function selectAllInGroup(group) {
    const list = listForGroup(group)
    const next = new Set(selectedUids.value)
    const allSelected = list.length > 0 && list.every(c => next.has(c.uid))
    if (allSelected) {
      for (const c of list) next.delete(c.uid)
    } else {
      for (const c of list) next.add(c.uid)
    }
    selectedUids.value = next
  }

  const selectedNpcCount = computed(() => {
    let n = 0
    for (const c of encounter.value.combatants) {
      if (c.type === 'npc' && selectedUids.value.has(c.uid)) n++
    }
    return n
  })

  const selectedRerollCount = computed(() => {
    let n = 0
    for (const c of encounter.value.combatants) {
      if (c.position === 'dead') continue
      if (selectedUids.value.has(c.uid)) n++
    }
    return n
  })

  function unselect(uid) {
    if (!selectedUids.value.has(uid)) return
    const next = new Set(selectedUids.value)
    next.delete(uid)
    selectedUids.value = next
  }

  function pruneToExisting() {
    const next = new Set()
    for (const c of encounter.value.combatants) {
      if (selectedUids.value.has(c.uid)) next.add(c.uid)
    }
    selectedUids.value = next
  }

  return {
    selectedUids,
    isSelected,
    toggleSelected,
    clearSelection,
    selectAllInGroup,
    selectedCountInGroup,
    selectedNpcCount,
    selectedRerollCount,
    unselect,
    pruneToExisting,
  }
}
