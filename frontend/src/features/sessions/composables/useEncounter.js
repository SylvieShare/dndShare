import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEncounterFlow } from '@/features/sessions/composables/useEncounterFlow'
import { useEncounterHp } from '@/features/sessions/composables/useEncounterHp'
import { useEncounterInitiative } from '@/features/sessions/composables/useEncounterInitiative'
import { useEncounterNpcData } from '@/features/sessions/composables/useEncounterNpcData'
import { useEncounterNpcs } from '@/features/sessions/composables/useEncounterNpcs'
import { useEncounterPlayers } from '@/features/sessions/composables/useEncounterPlayers'
import { useEncounterSelection } from '@/features/sessions/composables/useEncounterSelection'
import { useEncounterStates } from '@/features/sessions/composables/useEncounterStates'
import {
  ICON_COLOR_SWATCHES,
  ENCOUNTER_LETTERS,
  SAVE_DEBOUNCE_MS,
  SIDE_COLOR,
  SIDE_LABEL,
  SIDE_OPTIONS,
  bestiaryTypeRef,
  ensureBestiaryType,
  initRank,
  sideOf,
} from '@/features/sessions/lib/encounterHelpers'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { getEncounter, saveEncounter } from '@/shared/api/sessionsApi'
import { useSortable } from '@/shared/composables/useSortable'
import { useSuggestStore } from '@/stores/suggest'

export function useEncounter({ sessionUuid, participants, canEditPlayers }) {
  const encounter = ref({ active: false, round: 0, turnIndex: 0, combatants: [] })
  const loaded = ref(false)
  let saveTimer = null

  const players = useEncounterPlayers({ participants })
  const {
    findParticipant,
    applyLocalPatches,
    getPlayerAva,
    playerDisplayName,
    getPlayerAc,
    getPlayerHp,
    participantSubtitle,
    participantColor,
    mergeParticipants,
  } = players

  const npcData = useEncounterNpcData()

  async function load() {
    const raw = await getEncounter(sessionUuid).catch(() => null)
    const enc = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw
      : { active: false, round: 0, turnIndex: 0, combatants: [] }
    if (!Array.isArray(enc.combatants)) enc.combatants = []
    if (enc.active == null) enc.active = false
    if (enc.round == null) enc.round = 0
    if (enc.turnIndex == null) enc.turnIndex = 0
    mergeParticipants(enc)
    encounter.value = enc
    npcData.ensureNpcItems(enc.combatants)
    loaded.value = true
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveEncounter(sessionUuid, encounter.value).catch(() => {})
    }, SAVE_DEBOUNCE_MS)
  }

  watch(encounter, scheduleSave, { deep: true })

  watch(participants, () => {
    if (!loaded.value) return
    if (!mergeParticipants(encounter.value)) return
    encounter.value = { ...encounter.value, combatants: [...encounter.value.combatants] }
  })

  function getCombatant(uid) {
    return encounter.value.combatants.find(c => c.uid === uid)
  }

  function mutate(fn) {
    fn()
    encounter.value = { ...encounter.value, combatants: [...encounter.value.combatants] }
  }

  const inCombat = computed(() => {
    const list = encounter.value.combatants.filter(c => c.position === 'combat')
    if (!encounter.value.active) return list
    return [...list].sort((a, b) => {
      if (a.initiative == null && b.initiative == null) return (a.tieBreak ?? 0) - (b.tieBreak ?? 0)
      if (a.initiative == null) return 1
      if (b.initiative == null) return -1
      if (b.initiative !== a.initiative) return b.initiative - a.initiative
      return (a.tieBreak ?? 0) - (b.tieBreak ?? 0)
    })
  })

  function isAliveInTurn(c) {
    if (c.type === 'npc' && Number(c.hpCurrent) <= 0) return false
    return true
  }

  function isActiveInTurn(c) {
    if (!isAliveInTurn(c)) return false
    if (encounter.value.round === 0 && !c.surprised) return false
    return true
  }

  const turnOrder = computed(() => inCombat.value.filter(isActiveInTurn))

  const currentTurnIdx = computed(() => {
    const n = turnOrder.value.length
    if (!n) return 0
    return encounter.value.turnIndex % n
  })

  const currentTurnUid = computed(() => {
    const list = turnOrder.value
    if (!list.length) return null
    return list[currentTurnIdx.value]?.uid ?? null
  })

  const reserveNpcs = computed(() =>
    encounter.value.combatants.filter(c => c.type === 'npc' && c.position === 'reserve')
  )
  const reservePlayers = computed(() =>
    encounter.value.combatants.filter(c => c.type === 'player' && c.position === 'reserve')
  )
  const deadCombatants = computed(() =>
    encounter.value.combatants.filter(c => c.position === 'dead')
  )

  function listForGroup(group) {
    if (group === 'combat') return inCombat.value
    if (group === 'reserve-npc') return reserveNpcs.value
    if (group === 'reserve-player') return reservePlayers.value
    if (group === 'dead') return deadCombatants.value
    return []
  }

  const selection = useEncounterSelection({ encounter, listForGroup })

  const hp = useEncounterHp({
    getCombatant,
    mutate,
    canEditPlayers,
    findParticipant,
    applyLocalPatches,
    getPlayerHp,
    getPlayerAc,
    npcName:       npcData.npcName,
    npcAc:         npcData.npcAc,
    npcHpMax:      npcData.npcHpMax,
    npcHpFormula:  npcData.npcHpFormula,
  })

  const { initiativeBonus, rollInitiativeFor } = useEncounterInitiative({
    findParticipant,
    playerDisplayName,
    npcDex:  npcData.npcDex,
    npcName: npcData.npcName,
  })

  const states = useEncounterStates({
    participants,
    findParticipant,
    applyLocalPatches,
    getCombatant,
    mutate,
  })

  const npcs = useEncounterNpcs({
    encounter,
    unselect: selection.unselect,
    pruneToExisting: selection.pruneToExisting,
    selectedUids: selection.selectedUids,
    cacheItem: npcData.cacheItem,
  })

  const flow = useEncounterFlow({
    encounter,
    getCombatant,
    mutate,
    inCombat,
    turnOrder,
    selectedUids: selection.selectedUids,
    unselect: selection.unselect,
    rollInitiativeFor,
    npcHpMax: npcData.npcHpMax,
  })

  const sortable = useSortable({
    groups: {
      'combat':         { items: inCombat,        accepts: () => true },
      'reserve-npc':    { items: reserveNpcs,     accepts: (item) => item?.type === 'npc' },
      'reserve-player': { items: reservePlayers,  accepts: (item) => item?.type === 'player' },
      'dead':           { items: deadCombatants,  accepts: () => true },
    },
    getKey: c => c.uid,
    canDropAt: ({ item, toGroup, toIndex }) => {
      if (toGroup === 'combat') {
        if (!encounter.value.active) return false
        const list = inCombat.value.filter(c => c.uid !== item.uid)
        const before = list[toIndex - 1]
        const after = list[toIndex]
        const src = initRank(item)
        const beforeOk = !before || initRank(before) >= src
        const afterOk = !after || initRank(after) <= src
        return beforeOk && afterOk
      }
      return true
    },
    onDrop: (e) => flow.performSortDrop(e),
  })

  const npcReserveCollapsed = computed(() => sortable.sourceItem.value?.type === 'player')

  ensureBestiaryType()
  const suggestStore = useSuggestStore()

  const creatureTypeSuggestId = computed(() => {
    const f = (bestiaryTypeRef.value?.fields || []).find(x => x.key === 'creature_type')
    return f ? getSuggestId(f) : null
  })

  watch(creatureTypeSuggestId, sid => {
    if (sid != null) suggestStore.ensure(sid)
  }, { immediate: true })

  function resolveCreatureType(raw) {
    if (raw == null || raw === '') return null
    if (typeof raw === 'string' && !/^\d+$/.test(raw)) return raw
    const id = Number(raw)
    const sid = creatureTypeSuggestId.value
    if (sid == null) return null
    const items = suggestStore.items(sid) || []
    const found = items.find(i => Number(i.id) === id)
    if (found) return found.value
    if (suggestStore.loaded(sid)) suggestStore.ensureItems(sid, [id])
    return null
  }

  function subtitle(c) {
    if (c.type === 'player') return participantSubtitle(c.charId)
    const data = npcData.npcData(c)
    const parts = []
    const ct = resolveCreatureType(data.creature_type)
    if (ct) parts.push(ct)
    return parts.join(' · ')
  }

  function avatarStyle(c) {
    if (c.type === 'player') {
      if (c.iconColor) return { borderColor: c.iconColor, color: c.iconColor }
      return { borderColor: 'transparent', color: 'var(--info)' }
    }
    const color = c.iconColor || SIDE_COLOR[sideOf(c)]
    return { borderColor: color, color }
  }

  function tileColor(c) {
    if (c.type === 'player') return c.iconColor || null
    return c.iconColor || SIDE_COLOR[sideOf(c)]
  }

  function badgeClass(c) {
    return 'badge--' + sideOf(c)
  }

  function badgeLabel(c) {
    return SIDE_LABEL[sideOf(c)]
  }

  onMounted(load)
  onBeforeUnmount(() => clearTimeout(saveTimer))

  return {
    encounter,
    inCombat,
    turnOrder,
    currentTurnIdx,
    currentTurnUid,
    isActiveInTurn,
    reserveNpcs,
    reservePlayers,
    deadCombatants,
    npcReserveCollapsed,
    sortable,
    SIDE_OPTIONS,
    ICON_COLOR_SWATCHES,
    ENCOUNTER_LETTERS,
    // players
    playerDisplayName,
    getPlayerAva,
    participantColor,
    subtitle,
    avatarStyle,
    tileColor,
    badgeClass,
    badgeLabel,
    // selection
    selectedUids:           selection.selectedUids,
    isSelected:             selection.isSelected,
    toggleSelected:         selection.toggleSelected,
    clearSelection:         selection.clearSelection,
    selectAllInGroup:       selection.selectAllInGroup,
    selectedCountInGroup:   selection.selectedCountInGroup,
    selectedNpcCount:       selection.selectedNpcCount,
    selectedRerollCount:    selection.selectedRerollCount,
    // hp
    hpCalcNpc:              hp.hpCalcNpc,
    hpEditNpc:              hp.hpEditNpc,
    hpCalcPlayer:           hp.hpCalcPlayer,
    displayAc:              hp.displayAc,
    hpPercent:              hp.hpPercent,
    hpTempPercent:          hp.hpTempPercent,
    hpTempValue:            hp.hpTempValue,
    hpColor:                hp.hpColor,
    hpLabel:                hp.hpLabel,
    playerHpLabel:          hp.playerHpLabel,
    npcHpObj:               hp.npcHpObj,
    playerHpObj:            hp.playerHpObj,
    npcDsHp:                hp.npcDsHp,
    playerDsHp:             hp.playerDsHp,
    canEditPlayerHp:        hp.canEditPlayerHp,
    openHpCalc:             hp.openHpCalc,
    closeHpCalc:            hp.closeHpCalc,
    closeHpCalcPlayer:      hp.closeHpCalcPlayer,
    openNpcHpEdit:          hp.openNpcHpEdit,
    closeNpcHpEdit:         hp.closeNpcHpEdit,
    setNpcHpField:          hp.setNpcHpField,
    onNpcHpChange:          hp.onNpcHpChange,
    onPlayerHpChange:       hp.onPlayerHpChange,
    onNpcDsChange:          hp.onNpcDsChange,
    onPlayerDsChange:       hp.onPlayerDsChange,
    npcHpFormula:           hp.npcHpFormula,
    rollNpcHpFromFormula:   hp.rollNpcHpFromFormula,
    // initiative
    initiativeBonus,
    // states
    statesBlock:            states.statesBlock,
    statesValue:            states.statesValue,
    setStates:              states.setStates,
    setNote:                states.setNote,
    // npc data resolvers
    npcItem:                npcData.npcItem,
    npcName:                npcData.npcName,
    npcAc:                  npcData.npcAc,
    npcHpMax:               npcData.npcHpMax,
    // npcs
    showNpcPicker:          npcs.showNpcPicker,
    showSimpleForm:         npcs.showSimpleForm,
    detailNpc:              npcs.detailNpc,
    openNpcDetail:          npcs.openNpcDetail,
    closeNpcDetail:         npcs.closeNpcDetail,
    addNpc:                 npcs.addNpc,
    addSimpleNpc:           npcs.addSimpleNpc,
    cloneNpc:               npcs.cloneNpc,
    removeNpc:              npcs.removeNpc,
    removeSelectedNpcs:     npcs.removeSelectedNpcs,
    removeAllDeadNpcs:      npcs.removeAllDeadNpcs,
    // flow
    setInitiative:          flow.setInitiative,
    toggleSurprised:        flow.toggleSurprised,
    toggleSide:             flow.toggleSide,
    setSide:                flow.setSide,
    setIconColor:           flow.setIconColor,
    setMarkerLetter:        flow.setMarkerLetter,
    rerollSelectedInitiative: flow.rerollSelectedInitiative,
    toggleCombat:           flow.toggleCombat,
    nextTurn:               flow.nextTurn,
    prevTurn:               flow.prevTurn,
    selectedToMoveTo:       flow.selectedToMoveTo,
    sendSelectedTo:         flow.sendSelectedTo,
    sendToGraveyard:        flow.sendToGraveyard,
    reviveCombatant:        flow.reviveCombatant,
  }
}
