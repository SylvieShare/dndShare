<template>
  <main class="encounter-screen" :class="{ 'encounter-screen--active': snapshot?.active }">
    <div class="encounter-screen__glow" aria-hidden="true" />

    <header class="encounter-screen__header">
      <div class="encounter-screen__identity">
        <span class="encounter-screen__eyebrow">ЭКРАН БОЯ</span>
        <h1>{{ snapshot?.sessionName || 'Инициатива' }}</h1>
      </div>

      <div class="encounter-screen__status">
        <span v-if="snapshot?.active" class="encounter-screen__round">
          <span>Раунд</span>
          <strong>{{ snapshot.round }}</strong>
        </span>
        <span class="encounter-screen__connection" :class="{ 'is-offline': pollFailed }">
          <WifiOff v-if="pollFailed" :size="17" aria-hidden="true" />
          <Wifi v-else :size="17" aria-hidden="true" />
          {{ pollFailed ? 'Связь потеряна' : 'Обновляется' }}
        </span>
      </div>
    </header>

    <section v-if="loading" class="encounter-screen__empty" aria-live="polite">
      <div class="encounter-screen__sigil encounter-screen__sigil--loading">
        <Swords :size="54" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Подключаемся к бою</p>
      <h2>Готовим экран инициативы…</h2>
    </section>

    <section v-else-if="fatalError" class="encounter-screen__empty" role="alert">
      <div class="encounter-screen__sigil encounter-screen__sigil--error">
        <WifiOff :size="50" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Экран недоступен</p>
      <h2>Не удалось найти этот бой</h2>
      <span>Проверьте ссылку на экране мастера.</span>
    </section>

    <section v-else-if="!snapshot.active" class="encounter-screen__empty" aria-live="polite">
      <div class="encounter-screen__sigil">
        <Swords :size="58" aria-hidden="true" />
      </div>
      <p class="encounter-screen__empty-label">Все готово</p>
      <h2>Ожидаем начала боя</h2>
      <span>Инициатива появится здесь автоматически.</span>
    </section>

    <template v-else>
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
          :class="{ 'encounter-screen__turn-portrait--npc': currentCombatant.type === 'npc' }"
          :style="accentStyle(currentCombatant)"
        >
          <img v-if="currentCombatant.avatarUrl" :src="currentCombatant.avatarUrl" alt="" />
          <span v-else-if="currentCombatant.avatarSvg" v-html="currentCombatant.avatarSvg" />
          <UserRound v-else :size="82" :stroke-width="1.1" aria-hidden="true" />
        </div>
      </section>

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
    </template>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { HeartPulse, Swords, UserRound, Wifi, WifiOff } from '@lucide/vue'
import { getPublicEncounter } from '@/shared/api/sessionsApi'

const POLL_INTERVAL_MS = 1500

const route = useRoute()
const snapshot = ref(null)
const loading = ref(true)
const fatalError = ref(false)
const pollFailed = ref(false)
let pollTimer = null
let polling = false

const combatants = computed(() => snapshot.value?.combatants || [])
const currentCombatant = computed(() =>
  combatants.value.find(combatant => combatant.uid === snapshot.value?.currentUid) || null
)

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

async function poll() {
  if (polling) return
  polling = true
  try {
    const data = await getPublicEncounter(route.params.uuid)
    snapshot.value = data
    fatalError.value = false
    pollFailed.value = false
  } catch {
    if (!snapshot.value) fatalError.value = true
    else pollFailed.value = true
  } finally {
    loading.value = false
    polling = false
  }
}

function pollWhenVisible() {
  if (document.visibilityState === 'visible') poll()
}

onMounted(() => {
  poll()
  pollTimer = window.setInterval(poll, POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', pollWhenVisible)
})

onBeforeUnmount(() => {
  window.clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', pollWhenVisible)
})
</script>

<style scoped src="./styles/ViewEncounterScreen.css"></style>
<style scoped src="./styles/ViewEncounterScreenInitiative.css"></style>
<style scoped src="./styles/ViewEncounterScreenStates.css"></style>
