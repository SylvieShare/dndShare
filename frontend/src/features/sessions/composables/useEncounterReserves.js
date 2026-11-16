import { computed, ref, watch } from 'vue'
import { makeUid } from '../lib/encounterHelpers'
import { DEFAULT_RESERVE_ID, encounterReserveTabs, createEncounterReserve, renameEncounterReserve, removeEncounterReserve } from '../lib/encounterReserves'

export function useEncounterReserves({ encounter, loaded, mutate, getCombatant }) {
  const activeReserveId = ref(DEFAULT_RESERVE_ID)
  const reserveTabs = computed(() => encounterReserveTabs(encounter.value))
  const ids = computed(() => new Set(reserveTabs.value.map(tab => tab.id)))
  const reserveIdFor = combatant => ids.value.has(combatant.reserveTabId) ? combatant.reserveTabId : DEFAULT_RESERVE_ID
  const allReserveNpcs = computed(() => encounter.value.combatants.filter(c => c.type === 'npc' && c.position !== 'dead'))
  const reserveNpcs = computed(() => allReserveNpcs.value.filter(c => reserveIdFor(c) === activeReserveId.value))
  watch(ids, value => { if (!value.has(activeReserveId.value)) activeReserveId.value = DEFAULT_RESERVE_ID })
  function createReserve(name) {
    if (!loaded.value) return null
    const id = makeUid()
    const names = new Set(reserveTabs.value.map(tab => tab.name))
    let number = 2
    while (names.has(`Запас ${number}`)) number++
    const next = createEncounterReserve(encounter.value, id, name || `Запас ${number}`)
    if (next === encounter.value) return null
    encounter.value = next
    activeReserveId.value = id
    return id
  }
  function renameReserve(id, name) {
    if (loaded.value) encounter.value = renameEncounterReserve(encounter.value, id, name)
  }
  function removeReserve(id) {
    if (loaded.value) {
      encounter.value = removeEncounterReserve(encounter.value, id)
      if (activeReserveId.value === id && id !== DEFAULT_RESERVE_ID) activeReserveId.value = DEFAULT_RESERVE_ID
    }
  }
  function stampActiveReserve(combatant) {
    if (activeReserveId.value === DEFAULT_RESERVE_ID) delete combatant.reserveTabId
    else combatant.reserveTabId = activeReserveId.value
  }
  function moveNpcToReserve(combatant, id) {
    if (!loaded.value || !ids.value.has(id)) return
    mutate(() => {
      const row = getCombatant(combatant.uid)
      if (row?.type !== 'npc') return
      if (id === DEFAULT_RESERVE_ID) delete row.reserveTabId
      else row.reserveTabId = id
    })
  }
  function selectReserve(id) { if (ids.value.has(id)) activeReserveId.value = id }
  return { activeReserveId, reserveTabs, reserveNpcs, allReserveNpcs, reserveIdFor, createReserve, renameReserve, removeReserve, stampActiveReserve, moveNpcToReserve, selectReserve, canManageReserves: loaded }
}
