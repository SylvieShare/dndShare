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

    <AppModalFrame v-if="editOpen" title="Редактировать сессию" @close="editOpen = false">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="editName" :maxlength="255" autofocus @enter="saveEdit" />
      </FormField>
      <FormField label="Описание" vertical>
        <FormTextarea v-model:value="editDesc" :rows="3" :maxlength="1000" />
      </FormField>
      <template #footer>
        <FormActionButtons
          submit-text="Сохранить"
          loading-text="Сохранение..."
          :loading="editSaving"
          :can-submit="!!editName.trim()"
          @cancel="editOpen = false"
          @submit="saveEdit"
        />
      </template>
    </AppModalFrame>

    <template v-if="loading">
      <div class="loading-placeholder" />
    </template>

    <div
      v-else-if="session"
      class="campaign-workspace"
      :class="{ 'campaign-workspace--combat': workspaceMode === 'combat' }"
    >
      <ChapterGraphTab
        class="campaign-graph"
        :graph="chapterGraph"
        :session="session"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :locked="!!workspaceMode"
        :spotlight-chapter-id="workspaceChapter?.id ?? null"
        :workspace-mode="workspaceMode"
        @open-scenes="openChapterScenes"
        @open-combat="toggleCombatWorkspace"
        @edit-session="openEdit"
        @status-change="status => { session = { ...session, status } }"
      >
        <SessionCenterWorkspace
          v-if="workspaceMode"
          :mode="workspaceMode"
          :closing="workspaceClosing"
          :session-uuid="sessionUuid"
          :session="session"
          :participants="participants"
          :is-dm="isDm"
          :encounter="encounter"
          :chapter="workspaceChapter"
          :arcs="workspaceArcs"
          @close="closeWorkspace"
          @view-participant="openParticipant"
          @scene-count="chapterGraph.setSceneCount"
        />
      </ChapterGraphTab>

      <aside class="workspace-dock workspace-dock--left">
        <div class="col-section-title">
          <span>ИГРОКИ</span>
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
        </div>

        <div v-if="participants.length" class="participants-list">
          <SessionParticipantCard
            v-for="p in participants"
            :key="p.charId"
            :participant="p"
            :is-dm="isDm"
            :kick-pending="kickingIds.has(p.charId)"
            :color-pending="coloringIds.has(p.charId)"
            :combat-mode="workspaceMode === 'combat'"
            :combatant="encounterPlayer(p.charId)"
            :combat-selected="isEncounterPlayerSelected(p.charId)"
            :combat-current="isEncounterPlayerCurrent(p.charId)"
            :combat-editable="isDm"
            @view="openParticipant"
            @color="setParticipantColor"
            @kick="requestKickParticipant"
            @update:combat-selected="setEncounterPlayerSelected(p.charId, $event)"
            @update:initiative="setEncounterPlayerInitiative(p.charId, $event)"
          />
        </div>
        <div v-else class="no-participants">Участников пока нет</div>
        <div v-if="kickError || colorError" class="participant-action-error" role="alert">
          {{ kickError || colorError }}
        </div>
      </aside>

      <aside class="workspace-dock workspace-dock--right">
        <BaseTile class="side-tile workspace-tool-tile">
          <DicePanel />
        </BaseTile>
        <BaseTile class="side-tile workspace-tool-tile">
          <MusicPanel :is-dm="isDm" @open-library="musicLibraryOpen = true" />
        </BaseTile>
        <BaseTile
          class="side-tile workspace-tool-tile workspace-events-tile"
          :class="{ 'workspace-events-tile--collapsed': eventsCollapsed }"
        >
          <SessionEventsPanel @collapsed="eventsCollapsed = $event" />
        </BaseTile>
      </aside>

      <MusicLibraryModal v-if="musicLibraryOpen" :is-dm="isDm" @close="musicLibraryOpen = false" />

      <CharacterSheetModal
        v-if="sheetUuid"
        :uuid="sheetUuid"
        :is-dm="isDm"
        @close="sheetUuid = null"
      />

      <CharacterCreateModal
        v-if="createOpen"
        :templates="templates"
        :creating="creating"
        @close="createOpen = false"
        @create="createChar"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import BaseTile from '@/shared/ui/BaseTile.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import CharacterCreateModal from '@/features/character-list/components/CharacterCreateModal'
import CharacterSheetModal from '@/features/sessions/components/CharacterSheetModal.vue'
import ChapterGraphTab from '@/features/sessions/components/ChapterGraphTab.vue'
import DicePanel from '@/features/sessions/components/DicePanel.vue'
import MusicLibraryModal from '@/features/sessions/components/MusicLibraryModal.vue'
import MusicPanel from '@/features/sessions/components/MusicPanel.vue'
import SessionEventsPanel from '@/features/sessions/components/SessionEventsPanel.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'
import SessionCenterWorkspace from '@/features/sessions/components/SessionCenterWorkspace.vue'
import SessionParticipantCard from '@/features/sessions/components/SessionParticipantCard'
import { useParticipantPolling } from '@/features/sessions/composables/useParticipantPolling'
import { useChapterGraph } from '@/features/sessions/composables/useChapterGraph'
import { useEncounter } from '@/features/sessions/composables/useEncounter'
import { useSessionSelection } from '@/features/sessions/composables/useSessionSelection'
import { useAccountStore } from '@/stores/account'
import { useMusicStore } from '@/stores/music'
import { useTemplateStore } from '@/stores/template'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useUiStore } from '@/stores/ui'
import { sessionStatusConfig } from '@/features/sessions/composables/useSessionStatus'
import { pvName } from '@/features/sessions/lib/participantView'
import { createHeaderChip } from '@/shared/lib/appHeader'
import { fetchPost } from '@/shared/api/http'
import { getSession, joinSession, updateParticipantColor, updateSession } from '@/shared/api/sessionsApi'

const route = useRoute()
const router = useRouter()
const sessionUuid = route.params.uuid
const headerOwner = String(route.name)
const uiStore = useUiStore()

const session = ref(null)
const participants = ref([])
const loading = ref(true)
const editOpen = ref(false)
const editName = ref('')
const editDesc = ref('')
const editSaving = ref(false)
const coloringIds = ref(new Set())
const colorError = ref('')
const pendingKick = ref(null)
const pendingKickName = computed(() => pvName(pendingKick.value) || 'Игрок')

const accountStore = useAccountStore()
const musicStore = useMusicStore()
const sessionEventsStore = useSessionEventsStore()
const templateStore = useTemplateStore()
const musicLibraryOpen = ref(false)
const eventsCollapsed = ref(false)

const sheetUuid = ref(null)
const createOpen = ref(false)
const creating = ref(false)
const templates = computed(() => templateStore.all)

watch(sheetUuid, actorUuid => {
  sessionEventsStore.setActor(actorUuid, sessionUuid)
})

const isDm = computed(() => {
  const uid = accountStore.user?.id
  return !!(uid && session.value && session.value.ownerUserId === uid)
})

const encounter = reactive(useEncounter({
  sessionUuid,
  participants,
  canEditPlayers: isDm,
}))

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

watch(session, (value) => {
  const status = sessionStatusConfig(value?.status)
  uiStore.setHeaderContext({
    title: value?.name || route.meta?.title || 'Сессия',
    chip: value ? createHeaderChip(status.label, status.color) : null,
  }, headerOwner)
}, { immediate: true })

const chapterGraph = useChapterGraph({ sessionUuid, session })
const arcs = computed(() => chapterGraph.arcs.value)
const chapters = computed(() => chapterGraph.chapters.value)
const workspaceMode = ref(null)
const workspaceChapterId = ref(null)
const workspaceClosing = ref(false)
let workspaceCloseTimer = null
const workspaceChapter = computed(() => chapters.value.find(chapter => chapter.id === workspaceChapterId.value) ?? null)
const workspaceArcs = computed(() => arcs.value.filter(arc => arc.id === workspaceChapter.value?.arcId))

const { pollStatus, pollRunning, startPolling, forgetVersion } =
  useParticipantPolling({ participants })

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
  createOpen.value = true
}

async function createChar(payload) {
  if (creating.value) return
  creating.value = true
  try {
    const res = await fetchPost('/chars', payload)
    if (res?.charId != null) {
      await joinSession(sessionUuid, res.charId).catch(() => {})
      const fresh = await getSession(sessionUuid).catch(() => null)
      if (fresh?.participants) participants.value = fresh.participants
    }
    createOpen.value = false
    if (res?.uuid) sheetUuid.value = res.uuid
  } finally {
    creating.value = false
  }
}

async function openChapterScenes(chapter) {
  if (!chapterGraph.loaded.value) await chapterGraph.load()
  cancelWorkspaceClose()
  workspaceChapterId.value = chapter.id
  workspaceMode.value = 'scenes'
  workspaceClosing.value = false
}

async function toggleCombatWorkspace() {
  if (workspaceMode.value === 'combat' && !workspaceClosing.value) {
    closeWorkspace()
    return
  }
  if (!chapterGraph.loaded.value) await chapterGraph.load()
  cancelWorkspaceClose()
  const chapter = chapterGraph.focusCurrent()
  await nextTick()
  await nextTick()
  workspaceChapterId.value = chapter?.id ?? null
  workspaceMode.value = 'combat'
  workspaceClosing.value = false
}

function cancelWorkspaceClose() {
  if (workspaceCloseTimer != null) clearTimeout(workspaceCloseTimer)
  workspaceCloseTimer = null
}

function closeWorkspace() {
  if (!workspaceMode.value || workspaceClosing.value) return
  workspaceClosing.value = true
  cancelWorkspaceClose()
  workspaceCloseTimer = setTimeout(() => {
    workspaceMode.value = null
    workspaceChapterId.value = null
    workspaceClosing.value = false
    workspaceCloseTimer = null
  }, 190)
}

function openEdit() {
  editName.value = session.value?.name ?? ''
  editDesc.value = session.value?.description ?? ''
  editOpen.value = true
}

async function saveEdit() {
  if (!editName.value.trim() || editSaving.value) return
  editSaving.value = true
  try {
    await updateSession(sessionUuid, { name: editName.value.trim(), description: editDesc.value.trim() || null })
    session.value = { ...session.value, name: editName.value.trim(), description: editDesc.value.trim() || null }
    editOpen.value = false
  } finally {
    editSaving.value = false
  }
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

onMounted(() => {
  templateStore.ensure()
  getSession(sessionUuid)
    .then(async res => {
      session.value = res?.session ?? null
      participants.value = res?.participants ?? []
      await chapterGraph.load()
      startPolling()
      musicStore.setContext({ uuid: sessionUuid, dm: isDm.value })
      await sessionEventsStore.setContext({ uuid: sessionUuid, actorUuid: sheetUuid.value })
      await musicStore.ensureLibrary().catch(() => {})
      await musicStore.loadSessionState().catch(() => {})
    })
    .catch(() => router.replace('/sessions'))
    .finally(() => { loading.value = false })
})

onBeforeUnmount(() => {
  cancelWorkspaceClose()
  uiStore.clearHeaderContext(headerOwner)
  musicStore.dispose()
  sessionEventsStore.clearContext(sessionUuid)
})
</script>

<style scoped src="./styles/ViewSession.css"></style>
