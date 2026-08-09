<template>
  <div class="session-page">
    <AppModal v-if="editOpen" @close="editOpen = false">
      <h3 class="edit-title">Редактировать сессию</h3>
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="editName" :maxlength="255" autofocus @enter="saveEdit" />
      </FormField>
      <FormField label="Описание" vertical>
        <FormTextarea v-model:value="editDesc" :rows="3" :maxlength="1000" />
      </FormField>
      <FormActionButtons
        submit-text="Сохранить"
        loading-text="Сохранение..."
        :loading="editSaving"
        :can-submit="!!editName.trim()"
        @cancel="editOpen = false"
        @submit="saveEdit"
      />
    </AppModal>

    <template v-if="loading">
      <div class="loading-placeholder" />
    </template>

    <div v-else-if="session" class="layout">
      <aside class="col-left tile">
        <div class="col-section-title">
          ИГРОКИ
          <span class="poll-indicator" :class="pollStatus">
            <span class="poll-bar" :class="{ running: pollRunning }" />
          </span>
        </div>

        <div v-if="participants.length" class="participants-list">
          <SessionParticipantCard
            v-for="p in participants"
            :key="p.charId"
            :participant="p"
            :selected="selectedIds.has(p.charId)"
            :selection-mode="selectionMode"
            @select="onTileClick"
          />
        </div>
        <div v-else class="no-participants">Участников пока нет</div>

        <template v-if="participants.length">
          <button v-if="!selectionMode" class="pick-btn" @click="enterSelectionMode">
            Выбрать игроков для действия
          </button>
          <template v-else>
            <div class="sel-controls">
              <button class="sel-btn" @click="selectAll">Выбрать всех</button>
              <button
                class="sel-btn"
                @click="selectedIds.size ? clearSelection() : exitSelectionMode()"
              >{{ selectedIds.size ? 'Сбросить' : 'Отмена' }}</button>
            </div>
            <div class="sel-actions">
              <button
                class="action-btn action-btn--danger"
                :disabled="selectedIds.size === 0"
                @click="kickSelected"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 11L11 2M11 11L2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                Выгнать ({{ selectedIds.size }})
              </button>
            </div>
          </template>
        </template>

        <div class="invite-section">
          <button class="create-char-btn" @click="openCreate">
            <span class="cc-plus">+</span>
            Создать персонажа
          </button>

          <div class="invite-label">ПРИГЛАСИТЬ В СЕССИЮ</div>
          <div class="invite-code-row">
            <span class="invite-prefix">КОД</span>
            <span class="invite-code">{{ session.inviteCode }}</span>
            <button class="invite-copy" :title="codeCopied ? 'Скопировано' : 'Скопировать код'" @click="copyCode">
              <svg v-if="!codeCopied" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M2 10V2h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="invite-copy invite-copy--link" :title="linkCopied ? 'Скопировано' : 'Скопировать ссылку приглашения'" @click="copyLink">
              <svg v-if="!linkCopied" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M6 8l2 -2M5 9.5l-1 1a2.1 2.1 0 1 1 -3 -3l1 -1M9 4.5l1 -1a2.1 2.1 0 1 1 3 3l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div class="main-area">
        <div class="toolbar-tile tile">
          <SessionTopBar
            ref="topBarRef"
            :session="session"
            :session-uuid="sessionUuid"
            :is-dm="isDm"
            :initial-chapter="initialChapter"
            @edit="openEdit"
          />
        </div>

        <div class="main-row">
          <div class="col-middle">
            <SlidingTabs :tabs="tabItems" :model-value="activeTab" @update:model-value="selectTab" />
            <div class="tab-content tile">
              <EncounterTab
                v-if="tabsLoaded.combat"
                v-show="activeTab === 'combat'"
                :session-uuid="sessionUuid"
                :session="session"
                :participants="participants"
                :is-dm="isDm"
              />
              <SceneTab
                v-if="tabsLoaded.scene"
                v-show="activeTab === 'scene'"
                :session-uuid="sessionUuid"
                :chapters="chapters"
                :current-chapter-id="session.currentChapterId"
                :is-dm="isDm"
              />
            </div>
          </div>

          <aside class="col-right">
            <div class="tile side-tile">
              <DicePanel />
            </div>
            <div class="tile side-tile">
              <MusicPanel :is-dm="isDm" @open-library="musicLibraryOpen = true" />
            </div>
          </aside>
        </div>
      </div>

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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModal from '@/shared/ui/AppModal'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import SlidingTabs from '@/shared/ui/SlidingTabs'
import CharacterCreateModal from '@/features/character-list/components/CharacterCreateModal'
import CharacterSheetModal from '@/features/sessions/components/CharacterSheetModal.vue'
import DicePanel from '@/features/sessions/components/DicePanel.vue'
import EncounterTab from '@/features/sessions/components/EncounterTab'
import MusicLibraryModal from '@/features/sessions/components/MusicLibraryModal.vue'
import MusicPanel from '@/features/sessions/components/MusicPanel.vue'
import SceneTab from '@/features/sessions/components/SceneTab.vue'
import SessionParticipantCard from '@/features/sessions/components/SessionParticipantCard'
import SessionTopBar from '@/features/sessions/components/SessionTopBar.vue'
import { useParticipantPolling } from '@/features/sessions/composables/useParticipantPolling'
import { useSessionSelection } from '@/features/sessions/composables/useSessionSelection'
import { useAccountStore } from '@/stores/account'
import { useMusicStore } from '@/stores/music'
import { useTemplateStore } from '@/stores/template'
import { fetchPost } from '@/shared/api/http'
import { getSession, joinSession, updateSession } from '@/shared/api/sessionsApi'

const route = useRoute()
const router = useRouter()
const sessionUuid = route.params.uuid

const session = ref(null)
const participants = ref([])
const loading = ref(true)
const activeTab = ref('combat')
const tabsLoaded = reactive({ combat: true, scene: false, notes: false })
const tabItems = [
  { key: 'combat', title: 'Бой' },
  { key: 'scene', title: 'Сцена' },
  { key: 'notes', title: 'Заметки' },
]

function selectTab(key) {
  if (key === 'scene') return onActivateScene()
  activeTab.value = key
}
const initialChapter = ref(null)
const topBarRef = ref(null)

const editOpen = ref(false)
const editName = ref('')
const editDesc = ref('')
const editSaving = ref(false)

const accountStore = useAccountStore()
const musicStore = useMusicStore()
const templateStore = useTemplateStore()
const musicLibraryOpen = ref(false)

const sheetUuid = ref(null)
const createOpen = ref(false)
const creating = ref(false)
const templates = computed(() => templateStore.all)

const isDm = computed(() => {
  const uid = accountStore.user?.id
  return !!(uid && session.value && session.value.ownerUserId === uid)
})

const chapters = computed(() => topBarRef.value?.chapters ?? [])

const { pollStatus, pollRunning, startPolling, forgetVersion } =
  useParticipantPolling({ participants })

const {
  selectedIds, selectionMode, enterSelectionMode, exitSelectionMode,
  toggleSelect, selectAll, clearSelection, kickSelected,
} = useSessionSelection({ sessionUuid, participants, forgetVersion })

function onTileClick(charId) {
  if (selectionMode.value) {
    toggleSelect(charId)
    return
  }
  const p = participants.value.find(x => x.charId === charId)
  if (p) sheetUuid.value = p.charUuid
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

async function onActivateScene() {
  activeTab.value = 'scene'
  tabsLoaded.scene = true
  if (topBarRef.value && !topBarRef.value.chapters.length) {
    await topBarRef.value.loadChapters()
  }
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

const codeCopied = ref(false)
const linkCopied = ref(false)

async function copyCode() {
  if (!session.value?.inviteCode) return
  await navigator.clipboard.writeText(session.value.inviteCode).catch(() => {})
  codeCopied.value = true
  setTimeout(() => { codeCopied.value = false }, 1500)
}

async function copyLink() {
  if (!session.value?.inviteCode) return
  const url = `${window.location.origin}/join/${encodeURIComponent(session.value.inviteCode)}`
  await navigator.clipboard.writeText(url).catch(() => {})
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 1500)
}

onMounted(() => {
  templateStore.ensure()
  getSession(sessionUuid)
    .then(async res => {
      session.value = res?.session ?? null
      participants.value = res?.participants ?? []
      initialChapter.value = res?.currentChapter ?? null
      startPolling()
      musicStore.setContext({ uuid: sessionUuid, dm: isDm.value })
      await musicStore.ensureLibrary().catch(() => {})
      await musicStore.loadSessionState().catch(() => {})
    })
    .catch(() => router.replace('/sessions'))
    .finally(() => { loading.value = false })
})

onBeforeUnmount(() => {
  musicStore.dispose()
})
</script>

<style scoped>
.session-page {
  height: calc(100vh - var(--header-h));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg);
}

.layout {
  display: flex;
  gap: 25px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

/* shared tile look: block-bg surface, rounded, no frame */
.tile {
  background: var(--surface);
  border-radius: var(--r-lg);
}

.col-left {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
}

.col-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 0 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.poll-indicator {
  flex: 1;
  height: 2px;
  background: var(--popover-bg);
  border-radius: 2px;
  overflow: hidden;
  transition: box-shadow 0.3s;
}

.poll-indicator.changed {
  box-shadow: 0 0 6px var(--success);
}

.poll-indicator.error {
  box-shadow: 0 0 6px var(--danger);
}

.poll-bar {
  height: 100%;
  width: 0%;
  border-radius: 2px;
  background: var(--surface-active);
  transition: background 0.3s;
}

.poll-indicator.changed .poll-bar {
  width: 100%;
  background: var(--success);
}

.poll-indicator.error .poll-bar {
  width: 100%;
  background: var(--danger);
}

.poll-bar.running {
  animation: poll-sweep 2s linear forwards;
}

@keyframes poll-sweep {
  from { width: 0% }
  to   { width: 100% }
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  /* bleed past the column's horizontal padding so rows span the full tile width */
  margin: 0 -12px;
}

.participants-list :deep(.p-card:not(:last-child)) {
  border-bottom: 1px solid var(--border);
}

.no-participants {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 2px;
}

.pick-btn {
  width: 100%;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: none;
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 9px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.pick-btn:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.invite-section {
  margin-top: auto;
  padding: 12px;
  background: var(--bg);
  border-radius: var(--r-md);
}

.create-char-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: 1px dashed var(--surface-active);
  border-radius: 8px;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 9px 10px;
  margin-bottom: 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.create-char-btn:hover {
  border-color: var(--accent-hover);
  color: var(--text-1);
  background: color-mix(in srgb, var(--accent-hover) 8%, transparent);
}

.cc-plus {
  font-size: 16px;
  line-height: 1;
  color: var(--accent-hover);
}

.invite-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.invite-code-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px;
}

.invite-prefix {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}

.invite-code {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: 0.05em;
}

.invite-copy {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.invite-copy:hover {
  color: var(--text-2);
  background: var(--surface-raised);
}

.sel-controls {
  display: flex;
  gap: 6px;
}

.sel-btn {
  flex: 1;
  background: var(--surface-raised);
  border: none;
  border-radius: 8px;
  color: var(--text-2);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 7px 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.sel-btn:hover:not(:disabled) {
  background: var(--surface-active);
  color: var(--text-1);
}

.sel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sel-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  background: var(--surface-raised);
  border: none;
  border-radius: 8px;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 9px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: var(--surface-active);
  color: var(--text-1);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn--danger {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}

.action-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 22%, transparent);
  color: var(--danger);
}

.main-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.toolbar-tile {
  flex-shrink: 0;
}

.main-row {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 25px;
}

.col-middle {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--r-lg);
}

/* The active tab is the scroll container (not this rounded tile) — a rounded
   scroll container disables backdrop-filter blur on its sticky descendants. */
.tab-content > * {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.col-right {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 25px;
  overflow-y: auto;
}

.side-tile {
  flex-shrink: 0;
}

.loading-placeholder {
  flex: 1;
  margin: 24px;
  border-radius: 16px;
  background: var(--bg);
  animation: sk-pulse 1.4s ease-in-out infinite;
  min-height: 200px;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@media (max-width: 900px) {
  .col-right {
    display: none;
  }
}

@media (max-width: 640px) {
  .col-left {
    display: none;
  }

  .top-bar {
    padding: 10px 12px;
  }
}

.edit-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
}
</style>
