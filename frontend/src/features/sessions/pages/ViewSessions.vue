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
            <LoadingIndicator v-if="joining" label="..." size="xs" aria-hidden="true" style="color: inherit; margin-right: 6px" />{{ joining ? '...' : 'Войти' }}
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

    <LoadingState v-if="loading" label="Загружаем сессии…" />

    <div v-else-if="loadError" role="alert">{{ loadError }} <button type="button" @click="loadSessions()">Повторить</button></div>

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
              <span><LoadingIndicator v-if="joining" label="Проверяем…" size="xs" aria-hidden="true" style="color: inherit; margin-right: 6px" />{{ joining ? 'Проверяем…' : 'Войти' }}</span>
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
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { LoadingState } from '@sylvieshare/share-ui'
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
const loadError = ref('')
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
  loadError.value = ''
  loading.value = true
  const promise = preFetched || getSessions()
  promise
    .then(res => { if (res) applySessionsResponse(res) })
    .catch(() => { loadError.value = 'Не удалось загрузить сессии.' })
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

<style scoped src="./styles/ViewSessions.css"></style>
