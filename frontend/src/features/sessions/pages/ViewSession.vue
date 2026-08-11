<template>
  <div class="session-page">
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

    <div v-else-if="session" class="layout">
      <aside class="col-left">
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
            :is-dm="isDm"
            :kick-pending="kickingIds.has(p.charId)"
            @view="openParticipant"
            @kick="kickParticipant"
          />
        </div>
        <div v-else class="no-participants">Участников пока нет</div>
        <div v-if="kickError" class="participant-action-error" role="alert">{{ kickError }}</div>

        <BaseTile class="invite-section">
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
        </BaseTile>
      </aside>

      <div class="main-area">
        <BaseTile class="toolbar-tile">
          <SessionTopBar
            ref="topBarRef"
            :session="session"
            :session-uuid="sessionUuid"
            :is-dm="isDm"
            :initial-chapter="initialChapter"
            @edit="openEdit"
            @status-change="status => { session = { ...session, status } }"
          />
        </BaseTile>

        <div class="main-row">
          <div class="col-middle">
            <SlidingTabs :tabs="tabItems" :model-value="activeTab" @update:model-value="selectTab" />
            <BaseTile class="tab-content">
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
            </BaseTile>
          </div>

          <aside class="col-right">
            <BaseTile class="side-tile">
              <DicePanel />
            </BaseTile>
            <BaseTile class="side-tile">
              <MusicPanel :is-dm="isDm" @open-library="musicLibraryOpen = true" />
            </BaseTile>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import BaseTile from '@/shared/ui/BaseTile.vue'
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
import { useUiStore } from '@/stores/ui'
import { sessionStatusConfig } from '@/features/sessions/composables/useSessionStatus'
import { createHeaderChip } from '@/shared/lib/appHeader'
import { fetchPost } from '@/shared/api/http'
import { getSession, joinSession, updateSession } from '@/shared/api/sessionsApi'

const route = useRoute()
const router = useRouter()
const sessionUuid = route.params.uuid
const headerOwner = String(route.name)
const uiStore = useUiStore()

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

watch(session, (value) => {
  const status = sessionStatusConfig(value?.status)
  uiStore.setHeaderContext({
    title: value?.name || route.meta?.title || 'Сессия',
    chip: value ? createHeaderChip(status.label, status.color) : null,
  }, headerOwner)
}, { immediate: true })

const chapters = computed(() => topBarRef.value?.chapters ?? [])

const { pollStatus, pollRunning, startPolling, forgetVersion } =
  useParticipantPolling({ participants })

const {
  kickingIds, kickError, kickParticipant,
} = useSessionSelection({ sessionUuid, participants, forgetVersion })

function openParticipant(charId) {
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
  uiStore.clearHeaderContext(headerOwner)
  musicStore.dispose()
})
</script>

<style scoped src="./styles/ViewSession.css"></style>

<style scoped>
@media (max-width: 640px) {
  .toolbar-tile :deep(.session-info) {
    display: none;
  }
}
</style>
