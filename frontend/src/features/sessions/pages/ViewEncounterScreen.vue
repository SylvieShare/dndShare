<template>
  <main class="encounter-screen" :class="screenClasses">
    <header v-if="presentation?.visible && presentation.mode === 'idle'" class="encounter-screen__header">
      <div class="encounter-screen__identity">
        <span class="encounter-screen__eyebrow">ЭКРАН ПОКАЗА</span>
        <h1>{{ presentation?.sessionName || snapshot?.sessionName || 'Экран игроков' }}</h1>
      </div>
    </header>

    <aside v-if="pollFailed || (presentation?.mode === 'combat' && snapshot?.active)" class="encounter-screen__status" aria-live="polite">
      <span v-if="presentation?.mode === 'combat' && snapshot?.active" class="encounter-screen__round">
        <span>Раунд</span>
        <strong>{{ snapshot.round }}</strong>
      </span>
      <span v-if="pollFailed" class="encounter-screen__connection is-offline">
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
      <span>Инициатива появится здесь автоматически.</span>
    </section>

    <template v-else-if="presentation?.visible && presentation.mode === 'combat' && snapshot?.active">
      <section class="encounter-screen__initiative" aria-label="Порядок инициативы">
        <div class="encounter-screen__initiative-heading">
          <div>
            <span>ПОРЯДОК ХОДОВ</span>
            <h2>Инициатива</h2>
          </div>
          <span>{{ combatants.length }} {{ combatantCountLabel }}</span>
        </div>

        <TransitionGroup
          v-if="combatants.length"
          tag="ol"
          name="initiative-card"
          class="initiative-track"
        >
          <li
            v-for="(combatant, index) in combatants"
            :key="combatant.uid"
            class="initiative-card"
            :class="{
              'initiative-card--current': combatant.uid === snapshot.currentUid,
              'initiative-card--down': combatant.health.kind === 'down',
            }"
            :style="accentStyle(combatant)"
          >
            <div class="initiative-card__order">
              <span>{{ index + 1 }}</span>
              <small v-if="combatant.initiative != null">иниц. {{ combatant.initiative }}</small>
              <small v-else>без броска</small>
            </div>

            <div
              class="initiative-card__portrait"
              :class="{ 'initiative-card__portrait--npc': combatant.type === 'npc' }"
            >
              <img v-if="combatant.avatarUrl" :src="combatant.avatarUrl" alt="" />
              <span v-else-if="combatant.avatarSvg" v-html="combatant.avatarSvg" />
              <UserRound v-else :size="45" :stroke-width="1.15" aria-hidden="true" />
              <span v-if="combatant.markerLetter" class="initiative-card__marker">
                {{ combatant.markerLetter }}
              </span>
            </div>

            <div class="initiative-card__body">
              <strong>{{ combatant.name }}</strong>
              <span class="encounter-health" :class="healthClass(combatant)">
                <HeartPulse :size="14" aria-hidden="true" />
                {{ combatant.health.label }}
              </span>
              <div v-if="combatant.states.length || (combatant.surprised && snapshot.round === 0)" class="initiative-card__states">
                <span
                  v-for="state in combatant.states"
                  :key="state.name"
                  class="encounter-state"
                  :style="stateStyle(state)"
                >{{ state.name }}</span>
                <span v-if="combatant.surprised && snapshot.round === 0" class="encounter-state">Врасплох</span>
              </div>
            </div>

            <span v-if="combatant.uid === snapshot.currentUid" class="initiative-card__current-label">
              Текущий ход
            </span>
          </li>
        </TransitionGroup>

        <div v-else class="encounter-screen__no-combatants">
          Бой начался — участники скоро появятся.
        </div>
      </section>

      <section class="encounter-screen__turn" aria-live="polite">
        <div class="encounter-screen__turn-copy">
          <span class="encounter-screen__turn-label">СЕЙЧАС ХОДИТ</span>
          <template v-if="currentCombatant">
            <div class="encounter-screen__turn-name-row">
              <span
                v-if="currentCombatant.markerLetter"
                class="encounter-screen__turn-marker"
                :style="accentStyle(currentCombatant)"
              >{{ currentCombatant.markerLetter }}</span>
              <h2>{{ currentCombatant.name }}</h2>
            </div>
            <div class="encounter-screen__turn-meta">
              <span class="encounter-health" :class="healthClass(currentCombatant)">
                <HeartPulse :size="18" aria-hidden="true" />
                {{ currentCombatant.health.label }}
              </span>
              <span
                v-for="state in currentCombatant.states"
                :key="state.name"
                class="encounter-state"
                :style="stateStyle(state)"
              >{{ state.name }}</span>
              <span v-if="currentCombatant.surprised && snapshot.round === 0" class="encounter-state">
                Врасплох
              </span>
            </div>
          </template>
          <h2 v-else>Нет доступного хода</h2>
        </div>

        <div
          v-if="currentCombatant"
          class="encounter-screen__turn-portrait"
          :class="{
            'encounter-screen__turn-portrait--npc': currentCombatant.type === 'npc',
            'encounter-screen__turn-portrait--cover': currentCombatant.coverImageUrl,
          }"
          :style="accentStyle(currentCombatant)"
        >
          <img v-if="currentCombatant.coverImageUrl" :src="currentCombatant.coverImageUrl" alt="" />
          <img v-else-if="currentCombatant.avatarUrl" :src="currentCombatant.avatarUrl" alt="" />
          <span v-else-if="currentCombatant.avatarSvg" v-html="currentCombatant.avatarSvg" />
          <UserRound v-else :size="82" :stroke-width="1.1" aria-hidden="true" />
        </div>
      </section>
    </template>
    <div v-if="presentation?.visible && presentation.effect !== 'none'" class="presentation-effect" aria-hidden="true">
      <i v-for="index in 22" :key="index" :style="effectParticleStyle(index)" />
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { HeartPulse, Images, Swords, UserRound, Volume2, WifiOff } from '@lucide/vue'
import { getPublicDisplayMusic, getPublicEncounter, getPublicPresentation } from '@/shared/api/sessionsApi'
import { useDisplayMusic } from '@/features/sessions/composables/useDisplayMusic'

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
const displayMusic = useDisplayMusic()
let eventSource = null
let fallbackTimer = null
let controlTimer = null
let requestController = null
let syncing = false
let syncPending = false
let fallbackDelay = FALLBACK_INITIAL_MS
let fallbackRunning = false

const combatants = computed(() => snapshot.value?.combatants || [])
const currentCombatant = computed(() =>
  combatants.value.find(combatant => combatant.uid === snapshot.value?.currentUid) || null
)
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

const combatantCountLabel = computed(() => {
  const count = combatants.value.length
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'участников'
  if (last === 1) return 'участник'
  if (last >= 2 && last <= 4) return 'участника'
  return 'участников'
})

function accentStyle(combatant) {
  return combatant?.color ? { '--screen-combatant-color': combatant.color } : {}
}

function stateStyle(state) {
  return state?.color ? { '--screen-state-color': state.color } : {}
}

function healthClass(combatant) {
  return `encounter-health--${combatant?.health?.kind || 'unknown'}`
}

async function syncScreen() {
  if (syncing) {
    syncPending = true
    return
  }
  syncing = true
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
  document.addEventListener('visibilitychange', pollWhenVisible)
})

onBeforeUnmount(() => {
  eventSource?.close()
  stopFallback()
  window.clearInterval(controlTimer)
  requestController?.abort()
  displayMusic.dispose()
  document.removeEventListener('visibilitychange', pollWhenVisible)
})
</script>

<style scoped src="./styles/ViewEncounterScreen.css"></style>
<style scoped src="./styles/ViewEncounterScreenInitiative.css"></style>
<style scoped src="./styles/ViewEncounterScreenStates.css"></style>
