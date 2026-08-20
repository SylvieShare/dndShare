<template>
  <main class="encounter-screen" :class="screenClasses">
    <header v-if="presentation?.visible && presentation.mode === 'idle'" class="encounter-screen__header">
      <div class="encounter-screen__identity">
        <span class="encounter-screen__eyebrow">ЭКРАН ПОКАЗА</span>
        <h1>{{ presentation?.sessionName || snapshot?.sessionName || 'Экран игроков' }}</h1>
      </div>
    </header>

    <aside v-if="pollFailed" class="encounter-screen__status" aria-live="polite">
      <span class="encounter-screen__connection is-offline">
        <WifiOff :size="17" aria-hidden="true" />
        Связь потеряна
      </span>
    </aside>

    <button v-if="displayMusic.blocked.value" type="button" class="encounter-screen__sound-unlock" @click="displayMusic.unlock">
      <Volume2 :size="19" />
      Включить звук
    </button>

    <section v-if="loading" class="encounter-screen__empty" aria-live="polite">
      <div class="encounter-screen__sigil encounter-screen__sigil--loading">
        <Swords :size="54" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Подключаемся к сессии</p>
      <h2>Готовим экран игроков…</h2>
    </section>

    <section v-else-if="fatalError" class="encounter-screen__empty" role="alert">
      <div class="encounter-screen__sigil encounter-screen__sigil--error">
        <WifiOff :size="50" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Экран недоступен</p>
      <h2>Не удалось найти эту сессию</h2>
      <span>Проверьте ссылку на экране мастера.</span>
    </section>

    <section v-else-if="!presentation?.visible" class="encounter-screen__blackout" aria-live="polite">
      <span class="sr-only">Экран временно затемнён мастером</span>
    </section>

    <Transition :name="presentation?.transition === 'cut' ? '' : 'presentation-fade'" mode="out-in">
      <section
        v-if="presentation?.visible && presentation.mode === 'material'"
        :key="presentation.revision"
        class="presentation-frame"
      >
        <div class="presentation-frame__content" :class="materialFrameClasses">
          <img v-if="presentationImage" :src="presentationImage" :alt="presentationTitle" />
          <video v-else-if="presentationMaterial?.kind === 'video'" :src="presentationMaterial.assetUrl" controls autoplay playsinline />
          <article v-else-if="presentationMaterial?.kind === 'text' || presentationMaterial?.kind === 'note'">{{ presentationMaterial.content }}</article>
          <Images v-else :size="72" aria-hidden="true" />
        </div>
      </section>
    </Transition>

    <section v-if="presentation?.visible && presentation.mode === 'combat' && !snapshot?.active" class="encounter-screen__empty" aria-live="polite">
      <div class="encounter-screen__sigil">
        <Swords :size="58" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Все готово</p>
      <h2>Ожидаем начала боя</h2>
      <span>Очередь появится здесь автоматически.</span>
    </section>

    <template v-else-if="presentation?.visible && presentation.mode === 'combat' && snapshot?.active">
      <section class="encounter-combat-stage" aria-label="Текущий ход и очередь">
        <Transition name="turn-spotlight" mode="out-in">
          <article
            v-if="currentCombatant"
            :key="currentCombatant.uid"
            class="turn-spotlight"
            :style="accentStyle(currentCombatant)"
            aria-live="polite"
          >
            <div class="turn-spotlight__art" :class="{ 'turn-spotlight__art--npc': currentCombatant.type === 'npc' }">
              <img v-if="currentCombatant.coverImageUrl || currentCombatant.avatarUrl" :src="currentCombatant.coverImageUrl || currentCombatant.avatarUrl" alt="" />
              <span v-else-if="currentCombatant.avatarSvg" v-html="currentCombatant.avatarSvg" />
              <UserRound v-else :size="110" :stroke-width="1" aria-hidden="true" />
            </div>
            <div class="turn-spotlight__info">
              <span class="encounter-screen__turn-label">СЕЙЧАС ХОДИТ</span>
              <div class="turn-spotlight__name">
                <span v-if="currentCombatant.markerLetter" class="creature-marker">{{ currentCombatant.markerLetter }}</span>
                <h2>{{ currentCombatant.name }}</h2>
              </div>
              <div class="encounter-screen__turn-meta">
                <span v-if="presentation.showHealth" class="encounter-health" :class="healthClass(currentCombatant)">
                  <HeartPulse :size="18" aria-hidden="true" />
                  {{ healthDisplayText(currentCombatant) }}
                </span>
                <span v-for="state in currentCombatant.states" :key="state.name" class="encounter-state" :style="stateStyle(state)">{{ state.name }}</span>
                <span v-if="currentCombatant.surprised && snapshot.round === 0" class="encounter-state">Врасплох</span>
              </div>
            </div>
          </article>
          <div v-else key="no-turn" class="turn-spotlight turn-spotlight--empty">Нет доступного хода</div>
        </Transition>

        <div class="encounter-combat-side">
          <section class="encounter-queue" aria-label="Следующие ходы">
            <div class="encounter-screen__initiative-heading">
              <div><span>ДАЛЬШЕ ХОДЯТ</span><h2>Очередь</h2></div>
              <div class="encounter-queue__summary">
                <span class="encounter-screen__round"><span>Раунд</span><strong>{{ snapshot.round }}</strong></span>
                <span class="encounter-queue__total">{{ turnQueue.length }} в очереди</span>
              </div>
            </div>
            <TransitionGroup
              v-if="turnQueue.length"
              tag="ol"
              name="initiative-card"
              class="initiative-track"
              :class="{ 'initiative-track--overflow': queueStackCount > 1 }"
              :style="{ '--queue-slots': queueSlotCount }"
            >
              <li
                v-for="(combatant, index) in turnQueue"
                :key="combatant.uid"
                class="initiative-card"
                :class="{ 'initiative-card--down': combatant.health.kind === 'down', 'initiative-card--stacked': index >= queueStackStart }"
                :style="queueCardStyle(combatant, index)"
              >
                <div class="initiative-card__portrait" :class="{ 'initiative-card__portrait--npc': combatant.type === 'npc' }">
                  <img v-if="combatant.avatarUrl" :src="combatant.avatarUrl" alt="" />
                  <span v-else-if="combatant.avatarSvg" v-html="combatant.avatarSvg" />
                  <UserRound v-else :size="45" :stroke-width="1.15" aria-hidden="true" />
                  <span v-if="combatant.markerLetter" class="initiative-card__corner-marker">{{ combatant.markerLetter }}</span>
                </div>
                <span v-if="presentation.showHealth" class="encounter-health initiative-card__health" :class="healthClass(combatant)">{{ healthDisplayText(combatant) }}</span>
                <span v-if="queueStackCount > 1 && index === queueStackStart" class="initiative-card__stack-count">+{{ queueStackCount - 1 }}</span>
              </li>
            </TransitionGroup>
            <div v-if="turnQueue.length" class="initiative-direction" aria-hidden="true">
              <span>Следующий</span>
              <i />
              <span>Позже</span>
            </div>
            <div v-else class="encounter-screen__no-combatants">Других участников нет.</div>
          </section>

        </div>

        <section v-if="presentation.showGraveyard && graveyard.length" class="encounter-graveyard" aria-label="Кладбище">
          <div class="encounter-graveyard__heading"><Skull :size="18" /><span>Кладбище</span></div>
          <div class="encounter-graveyard__list">
            <article v-for="group in graveyard" :key="group.key" class="graveyard-card" :style="accentStyle(group)">
              <strong>{{ group.name }}</strong>
              <div class="graveyard-card__portrait">
                <img v-if="group.avatarUrl || group.coverImageUrl" :src="group.avatarUrl || group.coverImageUrl" alt="" />
                <span v-else-if="group.avatarSvg" v-html="group.avatarSvg" />
                <Skull v-else :size="26" aria-hidden="true" />
              </div>
              <b>×{{ group.count }}</b>
            </article>
          </div>
        </section>
      </section>
    </template>
    <TransitionGroup v-if="presentation?.visible && broadcastTimers.length" name="broadcast-timer" tag="aside" class="broadcast-timers" aria-label="Таймеры">
      <article v-for="timer in broadcastTimers" :key="timer.id" class="broadcast-timer" :class="{ 'broadcast-timer--completed': timer.completed }" :style="{ '--timer-progress': `${Math.round(timer.progress * 100)}%` }">
        <Timer :size="19" />
        <span><small>{{ timer.description }}</small><strong>{{ formatTimerDuration(timer.remainingMs) }}</strong></span>
        <i aria-hidden="true"><b /></i>
      </article>
    </TransitionGroup>
    <div v-if="presentation?.visible && presentation.effect !== 'none'" class="presentation-effect" aria-hidden="true">
      <i v-for="index in 22" :key="index" :style="effectParticleStyle(index)" />
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { HeartPulse, Images, Skull, Swords, Timer, UserRound, Volume2, WifiOff } from '@lucide/vue'
import { getPublicDisplayMusic, getPublicEncounter, getPublicPresentation } from '@/shared/api/sessionsApi'
import { useDisplayMusic } from '@/features/sessions/composables/useDisplayMusic'
import { formatTimerDuration, timerProgress, timerRemainingMs } from '@/features/sessions/lib/sessionTimers'

const CONTROL_SYNC_INTERVAL_MS = 45_000
const REQUEST_TIMEOUT_MS = 8_000
const FALLBACK_INITIAL_MS = 1_500
const FALLBACK_MAX_MS = 15_000

const route = useRoute()
const snapshot = ref(null)
const presentation = ref(null)
const loading = ref(true)
const fatalError = ref(false)
const pollFailed = ref(false)
const clock = ref(Date.now())
const serverOffsetMs = ref(0)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const displayMusic = useDisplayMusic()
let eventSource = null
let fallbackTimer = null
let controlTimer = null
let requestController = null
let syncing = false
let syncPending = false
let fallbackDelay = FALLBACK_INITIAL_MS
let fallbackRunning = false
let clockTimer = null

const combatants = computed(() => snapshot.value?.combatants || [])
const currentCombatant = computed(() =>
  combatants.value.find(combatant => combatant.uid === snapshot.value?.currentUid) || null
)
const currentIndex = computed(() => combatants.value.findIndex(combatant => combatant.uid === snapshot.value?.currentUid))
const turnQueue = computed(() => {
  if (!combatants.value.length) return []
  if (currentIndex.value < 0) return combatants.value
  return [
    ...combatants.value.slice(currentIndex.value + 1),
    ...combatants.value.slice(0, currentIndex.value),
  ]
})
const graveyard = computed(() => snapshot.value?.graveyard || [])
const queueSlotCount = computed(() => {
  const width = viewportWidth.value
  const screenPadding = Math.min(64, Math.max(24, width * 0.032))
  const cardSize = Math.min(128, Math.max(108, width * 0.08))
  const gap = Math.min(10, Math.max(8, width * 0.006))
  const baseAvailableWidth = Math.max(cardSize, width - screenPadding * 2 - 10)
  const baseSlots = Math.max(1, Math.floor((baseAvailableWidth + gap) / (cardSize + gap)))
  const stackReserve = turnQueue.value.length > baseSlots ? 82 : 10
  const availableWidth = Math.max(cardSize, width - screenPadding * 2 - stackReserve)
  return Math.max(1, Math.floor((availableWidth + gap) / (cardSize + gap)))
})
const queueStackStart = computed(() => Math.max(0, queueSlotCount.value - 1))
const queueStackCount = computed(() => Math.max(0, turnQueue.value.length - queueStackStart.value))
const serverNow = computed(() => clock.value - serverOffsetMs.value)
const broadcastTimers = computed(() => (presentation.value?.timers || []).map(timer => {
  const remainingMs = timerRemainingMs(timer, serverNow.value)
  return { ...timer, remainingMs, progress: timerProgress(timer, serverNow.value), completed: remainingMs <= 0 }
}))
const presentationMaterial = computed(() => presentation.value?.material || null)
const presentationImage = computed(() => {
  const material = presentationMaterial.value
  if (material?.kind === 'image' || material?.kind === 'map') return material.assetUrl || ''
  return ''
})
const presentationTitle = computed(() => presentation.value?.material?.name || 'Материал')
const materialFrameClasses = computed(() => {
  const material = presentationMaterial.value
  return material ? [`presentation-frame__content--${material.kind}`, material.kind === 'note' ? `presentation-note--${material.noteStyle}` : ''] : []
})
const screenClasses = computed(() => ({
  'encounter-screen--active': presentation.value?.mode === 'combat' && snapshot.value?.active,
  'encounter-screen--material': presentation.value?.visible && presentation.value?.mode === 'material',
  'encounter-screen--blackout': presentation.value && !presentation.value.visible,
  [`encounter-screen--effect-${presentation.value?.effect}`]: presentation.value?.visible && presentation.value?.effect !== 'none',
}))

function accentStyle(combatant) {
  return combatant?.color ? { '--screen-combatant-color': combatant.color } : {}
}

function queueCardStyle(combatant, index) {
  const style = accentStyle(combatant)
  if (index < queueStackStart.value) return { ...style, '--queue-column': index + 1, '--queue-stack-offset': 0, '--queue-z': 100 - index }
  return {
    ...style,
    '--queue-column': queueSlotCount.value,
    '--queue-stack-offset': Math.min(index - queueStackStart.value, 4),
    '--queue-z': 100 - index,
  }
}

function stateStyle(state) {
  return state?.color ? { '--screen-state-color': state.color } : {}
}

function healthClass(combatant) {
  return `encounter-health--${combatant?.health?.kind || 'unknown'}`
}

function hasNumericHealth(combatant) {
  return combatant?.health?.current != null && combatant?.health?.maximum != null
}

function healthNumbers(combatant) {
  return `${formatHealthValue(combatant.health.current)}/${formatHealthValue(combatant.health.maximum)}`
}

function healthDisplayText(combatant) {
  if (presentation.value?.healthDisplay === 'numbers' && hasNumericHealth(combatant)) {
    return `${healthNumbers(combatant)} HP`
  }
  return combatant?.health?.label || 'Неизвестно'
}

function formatHealthValue(value) {
  const number = Number(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

async function syncScreen() {
  if (syncing) {
    syncPending = true
    return
  }
  syncing = true
  const requestedAt = Date.now()
  requestController?.abort()
  requestController = new AbortController()
  const timeout = window.setTimeout(() => requestController?.abort(), REQUEST_TIMEOUT_MS)
  try {
    const options = { signal: requestController.signal }
    const nextPresentation = await getPublicPresentation(route.params.uuid, options)
    const [nextSnapshot, nextMusic] = await Promise.all([
      nextPresentation.mode === 'combat' ? getPublicEncounter(route.params.uuid, options) : Promise.resolve(snapshot.value),
      nextPresentation.broadcastMusic ? getPublicDisplayMusic(route.params.uuid, options) : Promise.resolve(null),
    ])
    presentation.value = nextPresentation
    const remoteTime = Number(nextPresentation.serverTime)
    if (Number.isFinite(remoteTime)) serverOffsetMs.value = ((requestedAt + Date.now()) / 2) - remoteTime
    if (nextPresentation.mode === 'combat') snapshot.value = nextSnapshot
    if (nextPresentation.broadcastMusic) await displayMusic.sync(nextMusic)
    else displayMusic.stop()
    fatalError.value = false
    pollFailed.value = false
  } catch {
    if (!presentation.value && !snapshot.value) fatalError.value = true
    else pollFailed.value = true
  } finally {
    window.clearTimeout(timeout)
    loading.value = false
    syncing = false
    requestController = null
    if (syncPending) {
      syncPending = false
      queueMicrotask(syncScreen)
    }
  }
}

function fallbackJitter(delay) {
  return Math.round(delay * (0.85 + Math.random() * 0.3))
}

function scheduleFallback(immediate = false) {
  if (fallbackTimer != null || fallbackRunning) return
  fallbackTimer = window.setTimeout(async () => {
    fallbackTimer = null
    fallbackRunning = true
    await syncScreen()
    fallbackRunning = false
    if (eventSource?.readyState !== EventSource.OPEN) {
      fallbackDelay = Math.min(FALLBACK_MAX_MS, fallbackDelay * 1.8)
      scheduleFallback()
    }
  }, immediate ? 0 : fallbackJitter(fallbackDelay))
}

function stopFallback() {
  if (fallbackTimer != null) window.clearTimeout(fallbackTimer)
  fallbackTimer = null
  fallbackDelay = FALLBACK_INITIAL_MS
}

function connectEvents() {
  eventSource?.close()
  const uuid = encodeURIComponent(route.params.uuid)
  eventSource = new EventSource(`/api/public/sessions/${uuid}/presentation/events`)
  eventSource.onopen = () => {
    stopFallback()
    syncScreen()
  }
  eventSource.onmessage = () => syncScreen()
  eventSource.onerror = () => scheduleFallback(true)
}

function effectParticleStyle(index) {
  return {
    '--particle-x': `${(index * 37) % 101}%`,
    '--particle-delay': `${-((index * 0.43) % 5)}s`,
    '--particle-duration': `${2.2 + (index % 7) * 0.38}s`,
    '--particle-size': `${2 + (index % 4) * 2}px`,
  }
}

function pollWhenVisible() {
  if (document.visibilityState === 'visible') syncScreen()
}

onMounted(() => {
  syncScreen()
  connectEvents()
  controlTimer = window.setInterval(syncScreen, CONTROL_SYNC_INTERVAL_MS)
  clockTimer = window.setInterval(() => { clock.value = Date.now() }, 250)
  window.addEventListener('resize', updateViewportWidth)
  document.addEventListener('visibilitychange', pollWhenVisible)
})

onBeforeUnmount(() => {
  eventSource?.close()
  stopFallback()
  window.clearInterval(controlTimer)
  window.clearInterval(clockTimer)
  requestController?.abort()
  displayMusic.dispose()
  document.removeEventListener('visibilitychange', pollWhenVisible)
  window.removeEventListener('resize', updateViewportWidth)
})

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}
</script>

<style scoped src="./styles/ViewEncounterScreen.css"></style>
<style scoped src="./styles/ViewEncounterScreenInitiative.css"></style>
<style scoped src="./styles/ViewEncounterScreenStates.css"></style>
