<template>
  <div class="page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Сессии</h1>
        <span v-if="sessions.length" class="total-badge">{{ sessions.length }}</span>
      </div>
      <div v-if="loading || hasAnything" class="header-right">
        <div class="code-entry" :class="{ 'code-entry--invalid': joinError }" :title="joinError || undefined">
          <span class="code-label">КОД</span>
          <input
            v-model="joinCode"
            class="code-input"
            type="text"
            placeholder="XXXXX-00000"
            maxlength="11"
            :aria-invalid="!!joinError"
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
      <div class="cards-list">
        <div v-for="n in 4" :key="n" class="card-skeleton" />
      </div>
    </template>

    <template v-else-if="hasAnything">
      <template v-if="showGm && gmSessions.length">
        <div v-if="showPlayer && playerSessions.length" class="section-title">Я веду</div>
        <div class="cards-list">
          <SessionCard v-for="s in gmSessions" :key="s.id" :session="s" @delete="confirmDelete" />
        </div>
      </template>

      <template v-if="showPlayer && playerSessions.length">
        <div class="section-title">Я играю</div>
        <div class="cards-list">
          <SessionCard v-for="s in playerSessions" :key="s.id" :session="s" @leave="confirmLeave" />
        </div>
      </template>
    </template>

    <div v-else class="empty-state">
      <div class="empty-heading">
        <span class="empty-kicker">{{ sessions.length ? 'В ЭТОЙ КАТЕГОРИИ ПОКА ПУСТО' : 'ВАШЕ СЛЕДУЮЩЕЕ ПРИКЛЮЧЕНИЕ' }}</span>
        <h2>{{ sessions.length ? 'Выберите, как продолжить' : 'С чего начнём?' }}</h2>
        <p>Станьте мастером новой истории или присоединитесь к уже начатой.</p>
      </div>

      <div class="empty-actions">
        <BaseTile class="empty-action-card" color="var(--accent)" tint>
          <div class="empty-action-icon"><Sparkles :size="24" /></div>
          <span class="empty-action-eyebrow">Хочу создать сессию</span>
          <h3>Соберите свою кампанию</h3>
          <p>Задайте название и систему — остальное можно наполнить уже по ходу приключения.</p>
          <button type="button" class="empty-create-button" @click="showModal = true">
            <Plus :size="17" />
            Создать сессию
          </button>
        </BaseTile>

        <BaseTile class="empty-action-card" color="var(--info)" tint>
          <div class="empty-action-icon empty-action-icon--join"><KeyRound :size="24" /></div>
          <span class="empty-action-eyebrow">Хочу присоединиться</span>
          <h3>Введите код от мастера</h3>
          <p>Код приглашения состоит из букв и цифр. После проверки останется выбрать персонажа.</p>
          <form class="empty-join-form" @submit.prevent="handleJoin">
            <FormTextInput
              v-model:value="joinCode"
              mono
              placeholder="XXXXX-00000"
              :maxlength="11"
              :invalid="!!joinError"
              aria-label="Код приглашения"
              @enter="handleJoin"
            />
            <button type="submit" class="empty-join-button" :disabled="!joinCode.trim() || joining" aria-label="Войти в сессию">
              <span>{{ joining ? 'Проверяем…' : 'Войти' }}</span>
              <ArrowRight :size="17" />
            </button>
          </form>
          <span class="empty-join-hint" :class="{ 'empty-join-hint--error': joinError }" role="status">
            {{ joinError || 'Например, DRAGN-20418' }}
          </span>
        </BaseTile>
      </div>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, KeyRound, Plus, Sparkles } from '@lucide/vue'
import SessionCard from '@/features/sessions/components/SessionCard'
import SessionCreateModal from '@/features/sessions/components/SessionCreateModal'
import SessionJoinModal from '@/features/sessions/components/SessionJoinModal'
import { BaseTile, ConfirmDialog, FormTextInput } from '@sylvieshare/share-ui'
import { consumePrefetch } from '@/app/router'
import { createSession, deleteSession, getSessionByCode, getSessions, leaveSession } from '@/shared/api/sessionsApi'

const FILTERS = [
  { key: 'all',     label: 'Все' },
  { key: 'gm',      label: 'Я веду' },
  { key: 'player',  label: 'Я играю' },
]

const router = useRouter()
const route = useRoute()
const sessions = ref([])
const loading = ref(true)
const showModal = ref(false)
const joinCode = ref('')
const joining = ref(false)
const joinError = ref('')
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
    ownerLogin: item.ownerLogin ?? null,
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
  joinError.value = ''
  try {
    const res = await getSessionByCode(code)
    if (res?.uuid) {
      joinSession.value = { uuid: res.uuid, name: res.name }
      joinCode.value = ''
    } else {
      joinError.value = 'Сессия с таким кодом не найдена'
    }
  } catch {
    joinError.value = 'Сессия с таким кодом не найдена'
  } finally {
    joining.value = false
  }
}

watch(joinCode, () => { joinError.value = '' })

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

const gmSessions     = computed(() => allGm.value)
const playerSessions = computed(() => allPlayer.value)

const showGm     = computed(() => filter.value !== 'player')
const showPlayer = computed(() => filter.value !== 'gm')

const hasAnything = computed(() =>
  (showGm.value && gmSessions.value.length) ||
  (showPlayer.value && playerSessions.value.length)
)

function filterCount(key) {
  if (key === 'all')     return sessions.value.length
  if (key === 'gm')      return allGm.value.length
  if (key === 'player')  return allPlayer.value.length
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

.code-entry--invalid {
  border-color: var(--danger);
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

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-skeleton {
  height: 188px;
  border-radius: var(--r-lg);
  background: var(--bg);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.card-skeleton:nth-child(even) {
  animation-delay: 0.2s;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 28px;
  min-height: 360px;
  padding: clamp(28px, 6vh, 72px) 0 24px;
}

.empty-heading {
  max-width: 520px;
  text-align: center;
}

.empty-kicker,
.empty-action-eyebrow {
  display: block;
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.empty-heading h2 {
  margin: 7px 0 5px;
  color: var(--text-1);
  font-size: clamp(22px, 3vw, 30px);
}

.empty-heading p,
.empty-action-card > p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.empty-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: min(820px, 100%);
}

.empty-action-card {
  min-height: 248px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.empty-action-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin-bottom: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
}

.empty-action-icon--join {
  border-color: color-mix(in srgb, var(--info) 30%, transparent);
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
}

.empty-action-card h3 {
  margin: 6px 0 7px;
  color: var(--text-1);
  font-size: 18px;
}

.empty-create-button,
.empty-join-button {
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 15px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--text-on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.empty-create-button {
  margin-top: auto;
}

.empty-create-button:hover,
.empty-join-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.empty-create-button:active,
.empty-join-button:active:not(:disabled) {
  transform: translateY(1px);
}

.empty-join-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
  margin-top: auto;
}

.empty-join-form :deep(.form-text-input) {
  height: 38px;
}

.empty-join-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.empty-join-hint {
  min-height: 16px;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.empty-join-hint--error {
  color: var(--danger);
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

  .header-right {
    width: 100%;
    flex-wrap: wrap;
  }

  .empty-state {
    gap: 22px;
    padding-top: 24px;
  }

  .empty-actions {
    grid-template-columns: 1fr;
  }

  .empty-action-card {
    min-height: 230px;
  }

  .card-skeleton { height: 278px; }
}
</style>
