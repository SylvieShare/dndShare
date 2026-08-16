<template>
  <div class="session-page">
    <ConfirmDialog
      v-if="pendingKick"
      title="Выгнать игрока?"
      :message="kickError || `${pendingKickName} больше не будет участвовать в этой сессии.`"
      confirm-label="Выгнать"
      loading-label="Исключение…"
      :loading="kickingIds.has(pendingKick.charId)"
      @confirm="confirmKickParticipant"
      @cancel="pendingKick = null"
    />

    <SessionEditModal
      v-if="editOpen && session"
      :session="session"
      :session-uuid="sessionUuid"
      @close="editOpen = false"
      @saved="applySessionEdit"
    />

    <template v-if="loading">
      <div class="loading-placeholder" />
    </template>

    <div
      v-else-if="session"
      class="campaign-workspace"
      :class="{
        'campaign-workspace--combat': primaryView === 'story' && workspaceMotionMode === 'combat',
        'campaign-workspace--players-collapsed': playersRailMode === 'compact',
        'campaign-workspace--hotkeys': isDm && primaryView === 'story' && workspaceMotionMode !== 'combat',
        'campaign-workspace--right-dock': rightDockOpen,
      }"
    >
      <ChapterGraphTab
        class="campaign-graph"
        :graph="chapterGraph"
        :session="session"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :locked="!!workspaceMode"
        :primary-view="primaryView"
        :workspace-chapter-id="workspaceChapter?.id ?? null"
        :workspace-scene="workspaceScene"
        :workspace-level="workspaceLevel"
        :workspace-mode="workspaceMode"
        :workspace-layout-mode="workspaceMotionMode"
        :dice-open="diceOpen"
        :music-open="musicOpen"
        :events-open="eventsOpen"
        :materials="sessionMaterials"
        :presentation="presentation"
        :settings="sessionSettings"
        @open-scenes="openChapterScenes"
        @select-view="selectPrimaryView"
        @open-combat="toggleCombatWorkspace"
        @toggle-dice="diceOpen = !diceOpen"
        @toggle-music="musicOpen = !musicOpen"
        @toggle-events="eventsOpen = !eventsOpen"
        @update-setting="updateSessionSetting"
        @send-block-to-combat="sendBlockToCombat"
        @workspace-context-change="updateWorkspaceContext"
        @edit-session="openEdit"
        @close-workspace="closeWorkspace"
      >
        <template #primary-workspace>
          <SessionWorldLayer
            :session-uuid="sessionUuid"
            :active-view="primaryView"
            :is-dm="isDm"
            :selected-location-id="selectedLocationId"
            :selected-npc-id="selectedNpcId"
			:selected-quest-id="selectedQuestId"
			:selected-material-id="selectedMaterialId"
			:world="sessionWorld"
            :materials="sessionMaterials"
            :presentation="presentation"
            @select-location="selectLocation"
            @select-npc="selectNpc"
            @select-quest="selectQuest"
			@select-material="selectMaterial"
			@open-scene="openRelatedScene"
          />
        </template>
        <SessionCenterWorkspace
          v-if="workspaceMode === 'combat' && (workspaceRevealed || workspaceClosing)"
          v-show="primaryView === 'story'"
          :closing="workspaceClosing"
          :session-uuid="sessionUuid"
          :session="session"
          :participants="participants"
          :is-dm="isDm"
          :encounter="encounter"
          :chapter="workspaceChapter"
          :scene="workspaceScene"
          @close="closeWorkspace"
          @view-participant="openParticipant"
        />
      </ChapterGraphTab>

      <div v-if="combatWorkspaceError" class="combat-import-error" role="alert">{{ combatWorkspaceError }}</div>

      <aside class="workspace-dock workspace-dock--left">
        <div class="col-section-title">
          <span class="players-heading-label">ИГРОКИ</span>
          <span class="poll-indicator" :class="pollStatus">
            <span class="poll-bar" :class="{ running: pollRunning }" />
          </span>
          <div class="players-actions">
            <RowActionMenu>
              <template #trigger>
                <button type="button" class="players-actions-trigger" title="Действия с игроками" aria-label="Действия с игроками">
                  +
                </button>
              </template>
              <template #default="{ close }">
                <RowActionItem action="create" @click="openCreate(); close()">Создать персонажа</RowActionItem>
                <RowActionItem action="copy" @click="copyCode(); close()">Скопировать код приглашения</RowActionItem>
                <RowActionItem action="copy-link" @click="copyLink(); close()">Скопировать ссылку приглашения</RowActionItem>
              </template>
            </RowActionMenu>
          </div>
          <button
            type="button"
            class="players-rail-toggle"
            :class="{ 'players-rail-toggle--error': kickError || colorError || participantOrderError }"
            :title="playersRailMode === 'compact' ? 'Развернуть игроков' : 'Свернуть игроков'"
            :aria-label="playersRailMode === 'compact' ? 'Развернуть игроков' : 'Свернуть игроков'"
            :aria-expanded="playersRailMode !== 'compact'"
            :disabled="playersRailMode === 'combat'"
            @click="togglePlayersRail"
          >
            <PanelLeftOpen v-if="playersRailMode === 'compact'" :size="15" />
            <PanelLeftClose v-else :size="15" />
          </button>
        </div>

        <div v-if="participants.length" class="participants-list" data-sortable-container="participants">
          <SessionParticipantCard
            v-for="(p, participantIndex) in displayedParticipants"
            :key="p.charId"
            :data-sortable-key="p.charId"
            :participant="p"
            :is-dm="isDm"
            :kick-pending="kickingIds.has(p.charId)"
            :color-pending="coloringIds.has(p.charId)"
            :reorder-enabled="isDm && participants.length > 1 && !participantOrderSaving"
            :reorder-placeholder="participantSortable.isSource(p)"
            :should-suppress-reorder-click="participantSortable.shouldSuppressClick"
            :compact="playersRailMode === 'compact'"
            :combat-mode="playersRailMode === 'combat'"
            :combatant="encounterPlayer(p.charId)"
            :combat-selected="isEncounterPlayerSelected(p.charId)"
            :combat-current="isEncounterPlayerCurrent(p.charId)"
            :combat-editable="isDm"
            @view="openParticipant"
            @color="setParticipantColor"
            @kick="requestKickParticipant"
            @drag-start="startParticipantDrag($event, p, participantIndex)"
            @update:combat-selected="setEncounterPlayerSelected(p.charId, $event)"
            @update:initiative="setEncounterPlayerInitiative(p.charId, $event)"
          />
        </div>
        <div v-else class="no-participants">Участников пока нет</div>
        <div v-if="kickError || colorError || participantOrderError" class="participant-action-error" role="alert">
          {{ kickError || colorError || participantOrderError }}
        </div>
      </aside>

      <aside class="workspace-dock workspace-dock--right">
        <BaseTile v-show="diceOpen" class="side-tile workspace-tool-tile">
          <DicePanel />
        </BaseTile>
        <BaseTile v-show="musicOpen" class="side-tile workspace-tool-tile">
          <MusicPanel :is-dm="isDm" @open-library="musicLibraryOpen = true" />
        </BaseTile>
        <BaseTile v-show="eventsOpen" class="side-tile workspace-tool-tile workspace-events-tile">
          <SessionEventsPanel />
        </BaseTile>
      </aside>

      <MusicLibraryModal v-if="musicLibraryOpen" :is-dm="isDm" @close="musicLibraryOpen = false" />

      <CharacterSheetModal
        v-if="sheetUuid"
        :uuid="sheetUuid"
        :is-dm="isDm"
        @close="sheetUuid = null"
      />

      <CharacterCreateWizardModal
        v-if="createOpen"
        ref="createModalRef"
        :creating="creating"
        :error="createError"
        @close="closeCreate"
        @create="createChar"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { PanelLeftClose, PanelLeftOpen } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseTile } from '@sylvieshare/share-ui'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import CharacterCreateWizardModal from '@/features/character-list/components/CharacterCreateWizardModal.vue'
import CharacterSheetModal from '@/features/sessions/components/CharacterSheetModal.vue'
import ChapterGraphTab from '@/features/sessions/components/ChapterGraphTab.vue'
import DicePanel from '@/features/sessions/components/DicePanel.vue'
import MusicLibraryModal from '@/features/sessions/components/MusicLibraryModal.vue'
import MusicPanel from '@/features/sessions/components/MusicPanel.vue'
import SessionEventsPanel from '@/features/sessions/components/SessionEventsPanel.vue'
import SessionEditModal from '@/features/sessions/components/SessionEditModal.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import SessionCenterWorkspace from '@/features/sessions/components/SessionCenterWorkspace.vue'
import SessionParticipantCard from '@/features/sessions/components/SessionParticipantCard'
import SessionWorldLayer from '@/features/sessions/components/SessionWorldLayer.vue'
import { useParticipantPolling } from '@/features/sessions/composables/useParticipantPolling'
import { useChapterGraph } from '@/features/sessions/composables/useChapterGraph'
import { useEncounter } from '@/features/sessions/composables/useEncounter'
import { useSessionSelection } from '@/features/sessions/composables/useSessionSelection'
import { useSessionWorkspace } from '@/features/sessions/composables/useSessionWorkspace'
import { useSessionPrimaryView } from '@/features/sessions/composables/useSessionPrimaryView'
import { useSessionWorld } from '@/features/sessions/composables/useSessionWorld'
import { useSessionParticipantRail } from '@/features/sessions/composables/useSessionParticipantRail'
import { useSessionMaterials } from '@/features/sessions/composables/useSessionMaterials'
import { useSessionPresentation } from '@/features/sessions/composables/useSessionPresentation'
import { useSessionSettings } from '@/features/sessions/composables/useSessionSettings'
import { useAccountStore } from '@/stores/account'
import { useMusicStore } from '@/stores/music'
import { useTemplateStore } from '@/stores/template'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useUiStore } from '@/stores/ui'
import { pvName } from '@/features/sessions/lib/participantView'
import { fetchPost } from '@/shared/api/http'
import { getSession, joinSession, reorderParticipants, updateParticipantColor } from '@/shared/api/sessionsApi'
import { itemsApi } from '@/shared/api/itemsApi'

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

const session = ref(null)
const participants = ref([])
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
watch(() => presentation.state.value.broadcastMusic, enabled => musicStore.setRemotePlayback(enabled), { immediate: true })
const { settings: sessionSettings, update: updateSessionSetting } = useSessionSettings({ sessionUuid })
provide('sessionMaterials', sessionMaterials)
provide('sessionWorld', sessionWorld)
provide('sessionPresentation', presentation)
const sessionEventsStore = useSessionEventsStore()
const templateStore = useTemplateStore()
const musicLibraryOpen = ref(false)
const SESSION_TOOL_PANELS_STORAGE_KEY = 'dnd-share:session-tool-panels:v1'
const savedToolPanels = readToolPanelVisibility()
const diceOpen = ref(savedToolPanels.dice)
const musicOpen = ref(savedToolPanels.music)
const eventsOpen = ref(savedToolPanels.events)
const rightDockOpen = computed(() => diceOpen.value || musicOpen.value || eventsOpen.value)
const combatImportError = ref('')

watch([diceOpen, musicOpen, eventsOpen], ([dice, music, events]) => {
  try {
    localStorage.setItem(SESSION_TOOL_PANELS_STORAGE_KEY, JSON.stringify({ dice, music, events }))
  } catch { /* localStorage can be unavailable in private mode */ }
})

function readToolPanelVisibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_TOOL_PANELS_STORAGE_KEY) || 'null')
    return {
      dice: saved?.dice !== false,
      music: saved?.music !== false,
      events: saved?.events !== false,
    }
  } catch {
    return { dice: true, music: true, events: true }
  }
}

const sheetUuid = ref(null)
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const createModalRef = ref(null)
let pendingCreatedCharacter = null

watch(sheetUuid, actorUuid => {
  sessionEventsStore.setActor(actorUuid, sessionUuid)
})

const isDm = computed(() => {
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

async function sendBlockToCombat({ block, chapter, scene, level }) {
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

  await toggleCombatWorkspace({ chapter, scene, level })
}

watch(session, (value) => {
  uiStore.setHeaderContext({
    title: value?.name || route.meta?.title || 'Сессия',
    chip: null,
  }, headerOwner)
}, { immediate: true })

const chapterGraph = useChapterGraph({ sessionUuid, session })
const {
  workspaceMode,
  workspaceChapter,
  workspaceScene,
  workspaceLevel,
  workspaceClosing,
  workspaceRevealed,
  workspaceMotionMode,
  openChapterScenes,
	openSceneWorkspace,
  toggleCombatWorkspace,
  restoreWorkspace,
  updateWorkspaceContext,
  closeWorkspace,
} = useSessionWorkspace({ sessionUuid, chapterGraph })

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

const { pollStatus, pollRunning, startPolling, forgetVersion } =
  useParticipantPolling({ participants, refreshParticipants })

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
    pendingCreatedCharacter = res

    await joinSession(sessionUuid, res.charId)
    const fresh = await getSession(sessionUuid).catch(() => null)
    if (fresh?.participants) {
      participants.value = fresh.participants
      startPolling()
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
    await chapterGraph.load()
    startPolling()
    musicStore.setContext({ uuid: sessionUuid, dm: isDm.value })
    await sessionEventsStore.setContext({ uuid: sessionUuid, actorUuid: sheetUuid.value })
    await musicStore.ensureLibrary().catch(() => {})
    await musicStore.loadSessionState().catch(() => {})
    if (isDm.value) {
      await Promise.all([
        sessionMaterials.load().catch(() => {}),
        presentation.load().catch(() => {}),
      ])
    }
  } catch {
    router.replace('/sessions')
    return
  } finally {
    loading.value = false
  }

  // Render the chapter canvas at its saved position before restoring the
  // workspace, so the chapter has a real starting point for its entrance.
  await nextTick()
  await restoreWorkspace()
})

onBeforeUnmount(() => {
  uiStore.clearHeaderContext(headerOwner)
  musicStore.dispose()
  sessionEventsStore.clearContext(sessionUuid)
})
</script>

<style scoped src="./styles/ViewSession.css"></style>
