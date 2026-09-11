import { useSessionTutorial } from '@/features/tutorials/composables/useSessionTutorial'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { useParticipantSync } from '@/features/sessions/composables/useParticipantSync'
import { useChapterGraph } from '@/features/sessions/composables/useChapterGraph'
import { useEncounter } from '@/features/sessions/composables/useEncounter'
import { useSessionSelection } from '@/features/sessions/composables/useSessionSelection'
import { useSessionWorkspace } from '@/features/sessions/composables/useSessionWorkspace'
import { useSessionPrimaryView } from '@/features/sessions/composables/useSessionPrimaryView'
import { useSessionWorld } from '@/features/sessions/composables/useSessionWorld'
import { useSessionParticipantRail } from '@/features/sessions/composables/useSessionParticipantRail'
import { useSessionMaterials } from '@/features/sessions/composables/useSessionMaterials'
import { useSessionPresentation } from '@/features/sessions/composables/useSessionPresentation'
import { useSessionTimers } from '@/features/sessions/composables/useSessionTimers'
import { useSessionSettings } from '@/features/sessions/composables/useSessionSettings'
import { useSessionHotkeys } from '@/features/sessions/composables/useSessionHotkeys'
import { useSessionLive } from '@/features/sessions/composables/useSessionLive'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'
import { useAccountStore } from '@/stores/account'
import { useMusicStore } from '@/stores/music'
import { useTemplateStore } from '@/stores/template'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useUiStore } from '@/stores/ui'
import { pvName } from '@/features/sessions/lib/participantView'
import { fetchPost } from '@/shared/api/http'
import { getSession, joinSession, reorderParticipants, updateParticipantColor } from '@/shared/api/sessionsApi'
import { itemsApi } from '@/shared/api/itemsApi'

export function useSessionPage() {
  const route = useRoute()
  const router = useRouter()
  const sessionUuid = route.params.uuid
  const headerOwner = String(route.name)
  const uiStore = useUiStore()
  const {
    activeView: primaryView,
    selectedLocationId,
    selectedNpcId,
    selectedQuestId,
    selectedMaterialId,
    selectView: selectPrimaryView,
    selectLocation,
    selectNpc,
    selectQuest,
    selectMaterial,
  } = useSessionPrimaryView({ sessionUuid, route, router })

  const tutorialRoot = ref(null)
  const tutorialReady = ref(false)
  const session = ref(null)
  const participants = ref([])
  const currentChapter = ref(null)
  const sessionRole = ref('')
  const myCharUuid = ref('')
  const loading = ref(true)
  const editOpen = ref(false)
  const coloringIds = ref(new Set())
  const colorError = ref('')
  const participantOrderSaving = ref(false)
  const participantOrderError = ref('')
  const pendingKick = ref(null)
  const pendingKickName = computed(() => pvName(pendingKick.value) || 'Игрок')

  const accountStore = useAccountStore()
  const musicStore = useMusicStore()
  const sessionMaterials = useSessionMaterials({ sessionUuid })
  const sessionWorld = useSessionWorld(sessionUuid)
  const presentation = useSessionPresentation({ sessionUuid, materials: sessionMaterials })
  const sessionTimers = useSessionTimers({ sessionUuid })
  watch(() => presentation.state.value.broadcastMusic, enabled => musicStore.setRemotePlayback(enabled), { immediate: true })
  const { settings: sessionSettings, update: updateSessionSetting } = useSessionSettings({ sessionUuid })
  provide('sessionMaterials', sessionMaterials)
  provide('sessionWorld', sessionWorld)
  provide('sessionPresentation', presentation)
  const sessionEventsStore = useSessionEventsStore()
  const templateStore = useTemplateStore()
  const showShortcutHints = ref(false)
  const shortcutLabels = sessionShortcutLabels()
  const chapterGraphTab = ref(null)
  const combatWorkspace = ref(null)
  const worldLayer = ref(null)
  const combatImportError = ref('')

  function toggleToolPanel(panel) {
    if (panel === 'dice') chapterGraphTab.value?.toggleDice()
  }

  const sheetUuid = ref(null)
  const createOpen = ref(false)
  const joinOwnOpen = ref(false)
  const creating = ref(false)
  const createError = ref('')
  const createModalRef = ref(null)
  let pendingCreatedCharacter = null

  watch(sheetUuid, actorUuid => {
    sessionEventsStore.setActor(actorUuid, sessionUuid)
  })

  const isDm = computed(() => {
    if (sessionRole.value) return sessionRole.value === 'gm'
    const uid = accountStore.user?.id
    return !!(uid && session.value && session.value.ownerUserId === uid)
  })

  watch([() => accountStore.status, isDm, session], ([status, dm, currentSession]) => {
    if (status === 'success' && currentSession && !dm && primaryView.value !== 'story') selectPrimaryView('story')
    if (status === 'success' && currentSession && dm) sessionWorld.load().catch(() => {})
  })

  const participantSortable = useSortable({
    groups: {
      participants: { items: participants },
    },
    getKey: participant => participant.charId,
    onDrop: async ({ fromIndex, toIndex }) => {
      if (fromIndex === toIndex || participantOrderSaving.value) return
      const previousIds = participants.value.map(participant => participant.charId)
      const reordered = reorderByDrop(participants.value, fromIndex, toIndex)
      participants.value = reordered
      participantOrderError.value = ''
      participantOrderSaving.value = true
      try {
        await reorderParticipants(sessionUuid, reordered.map(participant => participant.charId))
      } catch {
        const currentById = new Map(participants.value.map(participant => [participant.charId, participant]))
        const previousSet = new Set(previousIds)
        participants.value = [
          ...previousIds.map(charId => currentById.get(charId)).filter(Boolean),
          ...participants.value.filter(participant => !previousSet.has(participant.charId)),
        ]
        participantOrderError.value = 'Не удалось сохранить порядок игроков'
      } finally {
        participantOrderSaving.value = false
      }
    },
  })

  const displayedParticipants = computed(() => participantSortable.displayItems('participants'))

  function startParticipantDrag(event, participant, index) {
    if (!isDm.value || participants.value.length < 2 || participantOrderSaving.value) return
    participantSortable.startDrag(event, participant, 'participants', index)
  }

  const encounter = reactive(useEncounter({
    sessionUuid,
    participants,
    canEditPlayers: isDm,
    autoRollNpcHp: computed(() => sessionSettings.autoRollNpcHp),
  }))
  watch(() => encounter.encounter.active, (active, previous) => {
    if (previous !== undefined && active !== previous && isDm.value) window.setTimeout(() => presentation.load(), 750)
  })
  const combatWorkspaceError = computed(() => combatImportError.value || encounter.loadError || encounter.saveError)

  function encounterPlayer(charId) {
    return encounter.encounter.combatants.find(combatant =>
      combatant.type === 'player' && combatant.charId === charId
    ) ?? null
  }

  const encounterPlayers = computed(() => participants.value
    .map(participant => encounterPlayer(participant.charId))
    .filter(Boolean))
  const allEncounterPlayersSelected = computed(() =>
    encounterPlayers.value.length > 0
    && encounterPlayers.value.every(combatant => encounter.isSelected(combatant))
  )
  const selectedPlayersToCombat = computed(() => encounterPlayers.value.filter(combatant =>
    encounter.isSelected(combatant) && encounter.willMoveToGroup(combatant, 'combat')
  ))

  function toggleAllEncounterPlayers() {
    const shouldSelect = !allEncounterPlayersSelected.value
    for (const combatant of encounterPlayers.value) {
      if (encounter.isSelected(combatant) !== shouldSelect) encounter.toggleSelected(combatant)
    }
  }

  function sendSelectedPlayersToCombat() {
    encounter.sendCombatantsTo(selectedPlayersToCombat.value, 'combat')
  }

  function isEncounterPlayerSelected(charId) {
    const combatant = encounterPlayer(charId)
    return combatant ? encounter.isSelected(combatant) : false
  }

  function isEncounterPlayerCurrent(charId) {
    return encounter.currentTurnUid === encounterPlayer(charId)?.uid
  }

  function setEncounterPlayerSelected(charId, selected) {
    const combatant = encounterPlayer(charId)
    if (!combatant || encounter.isSelected(combatant) === selected) return
    encounter.toggleSelected(combatant)
  }

  function setEncounterPlayerInitiative(charId, value) {
    const combatant = encounterPlayer(charId)
    if (combatant) encounter.setInitiative(combatant, value)
  }

  async function importCombatBlock(block) {
    combatImportError.value = ''
    const creatures = Array.isArray(block?.data?.creatures) ? block.data.creatures : []
    const handbookIds = [...new Set(creatures
      .filter(creature => creature?.kind === 'handbook' && creature.itemId != null)
      .map(creature => creature.itemId))]
    const response = handbookIds.length ? await itemsApi.byIds(handbookIds).catch(() => null) : { items: [] }
    const handbookItems = new Map((response?.items || []).map(item => [String(item.id), item]))
    const missingHandbookCount = handbookIds.filter(id => !handbookItems.has(String(id))).length
    if (missingHandbookCount) {
      combatImportError.value = `Не удалось добавить существ из бестиария: ${missingHandbookCount}`
    }

    for (const creature of creatures) {
      const count = Math.max(1, Math.min(20, Math.floor(Number(creature?.count) || 1)))
      if (creature?.kind === 'handbook') {
        const item = handbookItems.get(String(creature.itemId))
        if (item) encounter.addNpc(item, count)
        continue
      }
      if (creature?.kind !== 'simple') continue
      for (let index = 0; index < count; index += 1) encounter.addSimpleNpc(creature)
    }
  }

  async function sendBlockToCombat({ block, chapter, scene, level }) {
    await importCombatBlock(block)
    await toggleCombatWorkspace({ chapter, scene, level })
  }

  watch(session, (value) => {
    uiStore.setHeaderContext({
      title: value?.name || route.meta?.title || 'Сессия',
      chip: null,
    }, headerOwner)
  }, { immediate: true })

  const { tutorial: sessionTutorial, mobile: tutorialMobile } = useSessionTutorial({
    root: tutorialRoot, session, isDm, ready: tutorialReady, primaryView,
  })

  const chapterGraph = useChapterGraph({ sessionUuid, session })
  const {
    workspaceMode,
    workspaceChapter,
    workspaceScene,
    workspaceLevel,
    workspaceClosing,
    workspaceMotionMode,
    openChapterScenes,
    openSceneWorkspace,
    toggleCombatWorkspace,
    restoreWorkspace,
    updateWorkspaceContext,
    openChapters,
    closeWorkspace,
  } = useSessionWorkspace({ sessionUuid, chapterGraph })

  async function openCombatTab(context = {}) {
    if (workspaceMode.value === 'combat' && !workspaceClosing.value) {
      if (primaryView.value !== 'story') selectPrimaryView('story')
      return
    }
    if (primaryView.value !== 'story') {
      selectPrimaryView('story')
      await nextTick()
    }
    await toggleCombatWorkspace(context)
  }

  async function selectSessionView(view) {
    if (workspaceMode.value === 'combat') {
      if (view === 'story') {
        selectPrimaryView('story')
        await nextTick()
        closeWorkspace()
        return
      }
      closeWorkspace({ forceChapters: true })
    }
    selectPrimaryView(view)
  }

  async function toggleCombatWorkspaceFromHotkey() {
    const context = primaryView.value === 'story'
      ? chapterGraphTab.value?.combatContext?.() ?? {}
      : {}
    if (primaryView.value !== 'story') {
      selectPrimaryView('story')
      await nextTick()
    }
    await toggleCombatWorkspace(context)
  }

  function toggleEncounterFromHotkey() {
    if (!encounter.encounter.active && encounter.selectedRerollCount === 0) return
    combatWorkspace.value?.toggleCombat()
  }

  useSessionHotkeys({
    enabled: computed(() => !!session.value),
    canSwitchView: isDm,
    showHints: showShortcutHints,
    selectView: selectSessionView,
    togglePanel: toggleToolPanel,
    rollDie: sides => chapterGraphTab.value?.rollDie(sides),
    listMode: computed(() => ['locations', 'npcs', 'quests', 'materials'].includes(primaryView.value)),
    previousListItem: () => worldLayer.value?.moveSelection(-1),
    nextListItem: () => worldLayer.value?.moveSelection(1),
    combatMode: computed(() => workspaceMode.value === 'combat'),
    canControlCombat: isDm,
    toggleCombatWorkspace: toggleCombatWorkspaceFromHotkey,
    toggleEncounter: toggleEncounterFromHotkey,
    previousTurn: () => { if (encounter.encounter.active) encounter.prevTurn() },
    nextTurn: () => { if (encounter.encounter.active) encounter.nextTurn() },
    togglePlayerSelection: toggleAllEncounterPlayers,
    toggleNpcSelection: () => encounter.selectAllInGroup('reserve-npc'),
    toggleSceneSelection: () => encounter.selectAllInGroup('combat'),
    rerollInitiative: () => encounter.rerollSelectedInitiative(),
    removeSelectedNpcs: () => encounter.removeSelectedNpcs(),
  })

  async function openRelatedScene(sceneId) {
    const scene = sessionWorld.scenesById.value.get(Number(sceneId))
    if (!scene) return
    selectPrimaryView('story')
    await nextTick()
    await openSceneWorkspace(scene)
  }
  const visibleWorkspaceMotionMode = computed(() => primaryView.value === 'story' ? workspaceMotionMode.value : null)
  const {
    mode: playersRailMode,
    toggle: togglePlayersRail,
  } = useSessionParticipantRail({ sessionUuid, workspaceMotionMode: visibleWorkspaceMotionMode })

  async function refreshParticipants() {
    const fresh = await getSession(sessionUuid)
    if (!Array.isArray(fresh?.participants)) return
    if (!isDm.value) {
      session.value = fresh.session ?? session.value
      currentChapter.value = fresh.currentChapter ?? null
      sessionRole.value = fresh.myRole || 'player'
      myCharUuid.value = fresh.myCharUuid || myCharUuid.value
    }
    const localById = new Map(participants.value.map(participant => [String(participant.charId), participant]))
    const serverById = new Map(fresh.participants.map(participant => [String(participant.charId), participant]))
    const withPendingColor = participant => coloringIds.value.has(participant.charId)
      ? { ...participant, color: localById.get(String(participant.charId))?.color ?? null }
      : participant
    participants.value = participantOrderSaving.value
      ? [
          ...participants.value.map(participant => serverById.get(String(participant.charId))).filter(Boolean),
          ...fresh.participants.filter(participant => !localById.has(String(participant.charId))),
        ].map(withPendingColor)
      : fresh.participants.map(withPendingColor)
  }

  async function refreshSessionOverview() {
    const fresh = await getSession(sessionUuid)
    if (fresh?.session) session.value = fresh.session
    if (Array.isArray(fresh?.participants)) participants.value = fresh.participants
    currentChapter.value = fresh?.currentChapter ?? null
    sessionRole.value = fresh?.myRole || sessionRole.value
    myCharUuid.value = fresh?.myCharUuid || myCharUuid.value
    syncVersions()
  }

  const {
    syncStatus, syncRunning, syncVersions,
    requestParticipants, requestCharacters, forgetVersion,
  } = useParticipantSync({ participants, refreshParticipants })

  const {
    status: liveStatus,
    catchingUp: liveCatchingUp,
    start: startSessionLive,
  } = useSessionLive({
    sessionUuid,
    onUpdate(update) {
      const tasks = []
      if (update?.session && !isDm.value) tasks.push(refreshSessionOverview())
      if (update?.participants) tasks.push(requestParticipants())
      else if (Array.isArray(update?.characterIds) && update.characterIds.length) {
        tasks.push(requestCharacters(update.characterIds))
      }
      if (update?.journal) tasks.push(sessionEventsStore.refresh())
      if (update?.connectedScreens != null && isDm.value) {
        presentation.setConnectedScreens(update.connectedScreens)
      }
      return Promise.all(tasks)
    },
    onCatchUp() {
      const tasks = [requestParticipants()]
      if (isDm.value) {
        tasks.push(sessionEventsStore.refresh(), presentation.loadConnections())
      }
      return Promise.all(tasks)
    },
  })

  const {
    kickingIds, kickError, kickParticipant,
  } = useSessionSelection({ sessionUuid, participants, forgetVersion })

  function openParticipant(charId) {
    const p = participants.value.find(x => x.charId === charId)
    if (p) sheetUuid.value = p.charUuid
  }

  function requestKickParticipant(charId) {
    kickError.value = ''
    pendingKick.value = participants.value.find(participant => participant.charId === charId) ?? null
  }

  async function confirmKickParticipant() {
    const charId = pendingKick.value?.charId
    if (charId == null) return
    if (await kickParticipant(charId)) pendingKick.value = null
  }

  async function setParticipantColor(charId, color) {
    if (coloringIds.value.has(charId)) return
    colorError.value = ''
    coloringIds.value = new Set([...coloringIds.value, charId])
    try {
      await updateParticipantColor(sessionUuid, charId, color)
      participants.value = participants.value.map(participant =>
        participant.charId === charId ? { ...participant, color: color || null } : participant
      )
    } catch {
      colorError.value = 'Не удалось сохранить цвет участника'
    } finally {
      const next = new Set(coloringIds.value)
      next.delete(charId)
      coloringIds.value = next
    }
  }

  function openCreate() {
    templateStore.ensure()
    createError.value = ''
    createOpen.value = true
  }

  function openJoinOwn() {
    joinOwnOpen.value = true
  }

  async function handleOwnCharacterJoined() {
    joinOwnOpen.value = false
    await refreshParticipants().catch(() => {})
    syncVersions()
  }

  function closeCreate() {
    if (creating.value) return
    createOpen.value = false
    createError.value = ''
  }

  async function createChar(payload) {
    if (creating.value) return
    creating.value = true
    createError.value = ''
    try {
      const res = pendingCreatedCharacter || await fetchPost('/chars', payload)
      if (res?.charId == null) throw new Error('missing character id')
      accountStore.setHasCharacters(true)
      pendingCreatedCharacter = res

      await joinSession(sessionUuid, res.charId)
      const fresh = await getSession(sessionUuid).catch(() => null)
      if (fresh?.participants) {
        participants.value = fresh.participants
        syncVersions()
      }

      createModalRef.value?.clearDraft()
      pendingCreatedCharacter = null
      createOpen.value = false
    } catch {
      createError.value = pendingCreatedCharacter
        ? 'Персонаж создан, но пока не добавлен в сессию. Нажмите «Создать персонажа», чтобы повторить.'
        : 'Не удалось создать персонажа. Попробуйте ещё раз.'
    } finally {
      creating.value = false
    }
  }

  function openEdit() {
    editOpen.value = true
  }

  function applySessionEdit(data) {
    session.value = { ...session.value, ...data }
    editOpen.value = false
  }

  async function copyCode() {
    if (!session.value?.inviteCode) return
    await navigator.clipboard.writeText(session.value.inviteCode).catch(() => {})
  }

  async function copyLink() {
    if (!session.value?.inviteCode) return
    const url = `${window.location.origin}/join/${encodeURIComponent(session.value.inviteCode)}`
    await navigator.clipboard.writeText(url).catch(() => {})
  }

  onMounted(async () => {
    templateStore.ensure()
    try {
      const res = await getSession(sessionUuid)
      session.value = res?.session ?? null
      participants.value = res?.participants ?? []
      currentChapter.value = res?.currentChapter ?? null
      sessionRole.value = res?.myRole || ''
      myCharUuid.value = res?.myCharUuid || ''
      syncVersions()
      if (isDm.value) {
        await encounter.load()
        await chapterGraph.load()
        musicStore.setContext({ uuid: sessionUuid, dm: true })
        await sessionEventsStore.setContext({ uuid: sessionUuid, actorUuid: sheetUuid.value })
        await musicStore.ensureLibrary().catch(() => {})
        await musicStore.loadSessionState().catch(() => {})
        await Promise.all([
          sessionMaterials.load().catch(() => {}),
          presentation.load().catch(() => {}),
          sessionTimers.load().catch(() => {}),
        ])
      }
      startSessionLive()
    } catch {
      router.replace('/sessions')
      return
    } finally {
      loading.value = false
    }
    if (!isDm.value) { tutorialReady.value = true; return }

    // Render the chapter canvas at its saved position before restoring the
    // workspace, so the chapter has a real starting point for its entrance.
    await nextTick()
    const restoredWorkspace = await restoreWorkspace()
    if (restoredWorkspace && workspaceMode.value === 'combat' && primaryView.value !== 'story') {
      selectPrimaryView('story')
    }
    tutorialReady.value = true
  })

  onBeforeUnmount(() => {
    uiStore.clearHeaderContext(headerOwner)
    musicStore.dispose()
    sessionEventsStore.clearContext(sessionUuid)
    sessionTimers.dispose()
  })

  return {
    allEncounterPlayersSelected, applySessionEdit, chapterGraph, chapterGraphTab, closeCreate,
    colorError, coloringIds, combatWorkspace, combatWorkspaceError, confirmKickParticipant,
    copyCode, copyLink, createChar, createError, createModalRef,
    createOpen, creating, currentChapter, displayedParticipants, editOpen,
    encounter, encounterPlayer, encounterPlayers, handleOwnCharacterJoined, importCombatBlock,
    isDm, isEncounterPlayerCurrent, isEncounterPlayerSelected, joinOwnOpen, kickError,
    kickingIds, liveCatchingUp, liveStatus, loading, myCharUuid,
    openChapterScenes, openChapters, openCombatTab, openCreate, openEdit,
    openJoinOwn, openParticipant, openRelatedScene, participantOrderError, participantOrderSaving,
    participantSortable, participants, pendingKick, pendingKickName, playersRailMode,
    presentation, primaryView, requestKickParticipant, selectLocation, selectMaterial,
    selectNpc, selectQuest, selectSessionView, selectedLocationId, selectedMaterialId,
    selectedNpcId, selectedPlayersToCombat, selectedQuestId, sendBlockToCombat, sendSelectedPlayersToCombat,
    session, sessionMaterials, sessionSettings, sessionTimers, sessionTutorial,
    sessionUuid, sessionWorld, setEncounterPlayerInitiative, setEncounterPlayerSelected, setParticipantColor,
    sheetUuid, shortcutLabels, showShortcutHints, startParticipantDrag, syncRunning,
    syncStatus, toggleAllEncounterPlayers, togglePlayersRail, tutorialMobile, tutorialRoot,
    updateSessionSetting, updateWorkspaceContext, workspaceChapter, workspaceClosing, workspaceLevel,
    workspaceMode, workspaceMotionMode, workspaceScene, worldLayer,
  }
}
