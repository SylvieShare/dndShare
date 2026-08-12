<template>
  <div class="page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Сессии</h1>
        <span v-if="sessions.length" class="total-badge">{{ sessions.length }}</span>
      </div>
      <div class="header-right">
        <div class="code-entry">
          <span class="code-label">КОД</span>
          <input
            v-model="joinCode"
            class="code-input"
            type="text"
            placeholder="XXXXX-00000"
            maxlength="11"
            @keydown.enter="handleJoin"
          />
          <button class="btn-join" :disabled="!joinCode.trim() || joining" @click="handleJoin">
            {{ joining ? '...' : 'Войти' }}
          </button>
        </div>
        <button class="btn-create" @click="showModal = true">+ Создать сессию</button>
      </div>
    </div>

    <div class="filter-pills">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="pill"
        :class="{ active: filter === f.key, 'pill--lg': f.key === 'gm' || f.key === 'player' }"
        @click="filter = f.key"
      >
        {{ f.label }}
        <span class="pill-count">{{ filterCount(f.key) }}</span>
      </button>
    </div>

    <template v-if="loading">
      <div v-for="n in 2" :key="n" class="hero-skeleton" />
    </template>

    <template v-else-if="hasAnything">
      <template v-if="showGm && gmSessions.length">
        <div v-if="showPlayer && playerSessions.length" class="section-title">Я веду</div>
        <SessionHero
          v-for="s in activeGm"
          :key="s.id"
          :session="s"
        />
        <div v-if="inactiveGm.length" class="cards-grid">
          <SessionCard v-for="s in inactiveGm" :key="s.id" :session="s" @delete="confirmDelete" />
        </div>
      </template>

      <template v-if="showPlayer && playerSessions.length">
        <div class="section-title">Я играю</div>
        <div class="cards-grid">
          <SessionCard v-for="s in playerSessions" :key="s.id" :session="s" @leave="confirmLeave" />
        </div>
      </template>
    </template>

    <div v-else class="empty">
      <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 4 6 14v20l18 10 18-10V14L24 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M24 4v40M6 14l18 10 18-10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <div class="empty-text">Сессий пока нет</div>
      <div class="empty-sub">Создайте свою кампанию или войдите по коду от мастера</div>
      <button class="btn-create" @click="showModal = true">+ Создать сессию</button>
    </div>

    <SessionCreateModal
      v-if="showModal"
      @close="showModal = false"
      @create="handleCreate"
    />

    <SessionJoinModal
      v-if="joinSession"
      :sessionUuid="joinSession.uuid"
      :sessionName="joinSession.name"
      @close="joinSession = null"
    />

    <ConfirmDialog
      v-if="pendingDelete"
      title="Удалить сессию?"
      :message="pendingDelete.name"
      confirmLabel="Удалить"
      @confirm="doDelete"
      @cancel="pendingDelete = null"
    />

    <ConfirmDialog
      v-if="pendingLeave"
      title="Выйти из сессии?"
      :message="pendingLeave.name"
      confirmLabel="Выйти"
      variant="warning"
      @confirm="doLeave"
      @cancel="pendingLeave = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SessionCard from '@/features/sessions/components/SessionCard'
import SessionCreateModal from '@/features/sessions/components/SessionCreateModal'
import SessionHero from '@/features/sessions/components/SessionHero'
import SessionJoinModal from '@/features/sessions/components/SessionJoinModal'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import { consumePrefetch } from '@/app/router'
import { createSession, deleteSession, getSessionByCode, getSessions, leaveSession } from '@/shared/api/sessionsApi'

const ACTIVE_STATUSES  = ['live', 'active']
const ARCHIVE_STATUSES = ['completed', 'archived']

const FILTERS = [
  { key: 'all',     label: 'Все' },
  { key: 'active',  label: 'Активные' },
  { key: 'gm',      label: 'Я веду' },
  { key: 'player',  label: 'Я играю' },
  { key: 'archive', label: 'Архив' },
]

const router = useRouter()
const route = useRoute()
const sessions = ref([])
const loading = ref(true)
const showModal = ref(false)
const joinCode = ref('')
const joining = ref(false)
const joinSession = ref(null)
const pendingDelete = ref(null)
const pendingLeave = ref(null)
const filter = ref('all')

function applySessionsResponse(res) {
  const items = Array.isArray(res) ? res : (res?.sessions ?? [])
  sessions.value = items.map(item => ({
    ...item.session,
    participants: item.participants ?? [],
    myRole: item.myRole,
    myCharUuid: item.myCharUuid ?? null,
    currentChapter: item.currentChapter ?? null,
  }))
}

function loadSessions(preFetched) {
  loading.value = true
  const promise = preFetched || getSessions()
  promise
    .then(res => { if (res) applySessionsResponse(res) })
    .finally(() => { loading.value = false })
}

async function handleJoin() {
  const code = joinCode.value.trim()
  if (!code || joining.value) return
  joining.value = true
  try {
    const res = await getSessionByCode(code)
    if (res?.uuid) {
      joinSession.value = { uuid: res.uuid, name: res.name }
      joinCode.value = ''
    }
  } finally {
    joining.value = false
  }
}

function confirmDelete(session) { pendingDelete.value = session }
function confirmLeave(session)  { pendingLeave.value = session }

async function doDelete() {
  const s = pendingDelete.value
  pendingDelete.value = null
  await deleteSession(s.id).catch(() => {})
  sessions.value = sessions.value.filter(x => x.id !== s.id)
}

async function doLeave() {
  const s = pendingLeave.value
  pendingLeave.value = null
  await leaveSession(s.uuid).catch(() => {})
  sessions.value = sessions.value.filter(x => x.id !== s.id)
}

async function handleCreate(payload) {
  const res = await createSession(payload)
  showModal.value = false
  if (res?.uuid) {
    router.push('/sessions/' + res.uuid)
  } else {
    loadSessions()
  }
}

const allGm     = computed(() => sessions.value.filter(s => s.myRole === 'gm'))
const allPlayer = computed(() => sessions.value.filter(s => s.myRole === 'player'))

function applyFilter(list) {
  if (filter.value === 'active')  return list.filter(s => ACTIVE_STATUSES.includes(s.status))
  if (filter.value === 'archive') return list.filter(s => ARCHIVE_STATUSES.includes(s.status))
  return list
}

const gmSessions     = computed(() => applyFilter(allGm.value))
const playerSessions = computed(() => applyFilter(allPlayer.value))

const showGm     = computed(() => filter.value !== 'player')
const showPlayer = computed(() => filter.value !== 'gm')

const activeGm       = computed(() => gmSessions.value.filter(s => ACTIVE_STATUSES.includes(s.status)))
const inactiveGm     = computed(() => gmSessions.value.filter(s => !ACTIVE_STATUSES.includes(s.status)))

const hasAnything = computed(() =>
  (showGm.value && gmSessions.value.length) ||
  (showPlayer.value && playerSessions.value.length)
)

function filterCount(key) {
  if (key === 'all')     return sessions.value.length
  if (key === 'active')  return sessions.value.filter(s => ACTIVE_STATUSES.includes(s.status)).length
  if (key === 'gm')      return allGm.value.length
  if (key === 'player')  return allPlayer.value.length
  if (key === 'archive') return sessions.value.filter(s => ARCHIVE_STATUSES.includes(s.status)).length
  return 0
}

onMounted(() => loadSessions(consumePrefetch(route.fullPath)))
</script>

<style scoped>
.page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
  min-height: calc(100vh - var(--header-h));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1, var(--text-on-accent));
  margin: 0;
}

.total-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--surface);
  border-radius: 6px;
  padding: 2px 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.code-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 0 10px;
  height: 34px;
}

.code-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.code-input {
  background: none;
  border: none;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  outline: none;
  width: 108px;
  padding: 0;
}

.code-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
  letter-spacing: 0;
}

.btn-join {
  height: 24px;
  padding: 0 12px;
  background: var(--surface-raised);
  color: var(--text-2);
  border: 1px solid var(--surface-active);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.btn-join:hover:not(:disabled) {
  background: var(--surface-active);
  color: var(--accent-soft);
}

.btn-join:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-create {
  height: 34px;
  padding: 0 16px;
  background: var(--accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.btn-create:hover {
  background: var(--accent-hover);
}

.filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--surface-raised);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.pill:hover {
  background: var(--popover-bg);
  color: var(--text-2);
}

.pill.active {
  background: var(--popover-bg);
  border-color: var(--surface-active);
  color: var(--text-1);
  font-weight: 600;
}

.pill-count {
  font-size: 11px;
  color: var(--text-muted);
}

.pill.active .pill-count {
  color: var(--text-muted);
}

.pill--lg {
  padding: 0 18px;
  font-size: 14px;
}

.pill--lg .pill-count {
  font-size: 13px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  padding-top: 4px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hero-skeleton {
  height: 180px;
  border-radius: 16px;
  background: var(--bg);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.hero-skeleton:nth-child(3) {
  animation-delay: 0.2s;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 280px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  opacity: 0.6;
  margin-bottom: 2px;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-2);
}

.empty-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 320px;
  margin-bottom: 6px;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@media (max-width: 640px) {
  .page {
    padding: 16px 12px;
  }

  .header-left {
    display: none;
  }

  .cards-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
