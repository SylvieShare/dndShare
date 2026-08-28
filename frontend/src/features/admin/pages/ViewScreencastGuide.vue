<template>
  <main class="screencast-guide" :style="{ '--speech-size': `${speechSize}px` }">
    <header class="guide-header">
      <div class="guide-heading">
        <span class="guide-kicker">DNDSHARE · СКРИНКАСТ</span>
        <h1>План выступления</h1>
        <p>Синхронный сценарий на {{ totalTimeLabel }}. Левая колонка — действия, правая — текст.</p>
      </div>

      <div class="guide-status" aria-live="polite">
        <div class="guide-progress-copy">
          <strong>Шаг {{ currentIndex + 1 }} из {{ screencastSteps.length }}</strong>
          <span>{{ progress }}%</span>
        </div>
        <div class="guide-progress" aria-hidden="true">
          <span :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <div class="guide-controls" aria-label="Настройки телесуфлёра">
        <button type="button" aria-label="Уменьшить текст" :disabled="fontLevel === 0" @click="fontLevel--">А−</button>
        <button type="button" aria-label="Увеличить текст" :disabled="fontLevel === fontSizes.length - 1" @click="fontLevel++">А+</button>
        <button type="button" :class="{ active: wakeLockActive }" @click="toggleWakeLock">
          {{ wakeLockActive ? 'Экран не гаснет' : 'Не гасить экран' }}
        </button>
        <button type="button" @click="resetProgress">Сначала</button>
      </div>
    </header>

    <details class="guide-preparation">
      <summary>
        <span>Подготовить до записи</span>
        <strong>{{ preparationDone }}/{{ screencastPreparation.length }}</strong>
      </summary>
      <label v-for="(item, index) in screencastPreparation" :key="item">
        <input v-model="preparation[index]" type="checkbox">
        <span>{{ item }}</span>
      </label>
    </details>

    <div class="guide-table-head" aria-hidden="true">
      <span>Что делать на сайте</span>
      <span>Что говорить</span>
    </div>

    <section class="guide-steps" aria-label="Сценарий скринкаста">
      <article
        v-for="(step, index) in screencastSteps"
        :id="`screencast-step-${step.id}`"
        :key="step.id"
        class="guide-step"
        :class="{
          active: index === currentIndex,
          completed: index < currentIndex,
        }"
        :aria-current="index === currentIndex ? 'step' : undefined"
        tabindex="0"
        @click="selectStep(index)"
        @keydown.enter.prevent="selectStep(index)"
        @keydown.space.prevent="selectStep(index)"
      >
        <div class="step-meta">
          <span class="step-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="step-time">{{ step.time }}</span>
          <strong>{{ step.title }}</strong>
          <span class="step-state">{{ index < currentIndex ? 'Готово' : index === currentIndex ? 'Сейчас' : 'Дальше' }}</span>
        </div>

        <div class="step-action">
          <ol>
            <li v-for="action in step.action" :key="action">{{ action }}</li>
          </ol>
        </div>

        <div class="step-speech">
          <p v-for="paragraph in step.speech" :key="paragraph">{{ paragraph }}</p>
          <div class="step-criteria">
            <span v-for="criterion in step.criteria" :key="criterion">{{ criterion }}</span>
          </div>
        </div>
      </article>
    </section>

    <footer class="guide-footer">
      <button type="button" :disabled="currentIndex === 0" @click="moveStep(-1)">← Назад</button>
      <div>
        <strong>{{ screencastSteps[currentIndex].title }}</strong>
        <span>{{ screencastSteps[currentIndex].time }}</span>
      </div>
      <button type="button" :disabled="currentIndex === screencastSteps.length - 1" @click="moveStep(1)">Дальше →</button>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  screencastPreparation,
  screencastSteps,
  screencastTotalSeconds,
} from '@/features/admin/data/screencastGuide'

const progressKey = 'dndshare-screencast-guide-step'
const fontKey = 'dndshare-screencast-guide-font'
const preparationKey = 'dndshare-screencast-guide-preparation'
const fontSizes = [17, 19, 21, 23, 25]
const currentIndex = ref(0)
const fontLevel = ref(1)
const preparation = ref(screencastPreparation.map(() => false))
const wakeLock = ref(null)
const wakeLockActive = ref(false)
const wakeLockRequested = ref(false)

const speechSize = computed(() => fontSizes[fontLevel.value])
const progress = computed(() => {
  const elapsed = screencastSteps
    .slice(0, currentIndex.value + 1)
    .reduce((total, step) => total + step.durationSeconds, 0)
  return Math.round((elapsed / screencastTotalSeconds) * 100)
})
const preparationDone = computed(() => preparation.value.filter(Boolean).length)
const totalTimeLabel = computed(() => `${Math.floor(screencastTotalSeconds / 60)}:${String(screencastTotalSeconds % 60).padStart(2, '0')}`)

function readStoredNumber(key, fallback, maximum) {
  const value = Number.parseInt(localStorage.getItem(key) || '', 10)
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : fallback
}

function selectStep(index, scroll = false) {
  currentIndex.value = Math.min(Math.max(index, 0), screencastSteps.length - 1)
  if (!scroll) return
  nextTick(() => {
    document.getElementById(`screencast-step-${screencastSteps[currentIndex.value].id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  })
}

function moveStep(delta) {
  selectStep(currentIndex.value + delta, true)
}

function resetProgress() {
  selectStep(0, true)
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    wakeLockRequested.value = false
    return
  }
  if (document.visibilityState !== 'visible') return
  try {
    wakeLock.value = await navigator.wakeLock.request('screen')
    wakeLockActive.value = true
    wakeLock.value.addEventListener('release', () => {
      wakeLockActive.value = false
      wakeLock.value = null
    }, { once: true })
  } catch {
    wakeLockActive.value = false
    wakeLockRequested.value = false
  }
}

async function toggleWakeLock() {
  if (wakeLockRequested.value) {
    wakeLockRequested.value = false
    if (wakeLock.value) await wakeLock.value.release()
    else wakeLockActive.value = false
    return
  }
  wakeLockRequested.value = true
  await requestWakeLock()
}

function restoreWakeLock() {
  if (wakeLockRequested.value && !wakeLock.value) requestWakeLock()
}

watch(currentIndex, value => localStorage.setItem(progressKey, String(value)))
watch(fontLevel, value => localStorage.setItem(fontKey, String(value)))
watch(preparation, value => localStorage.setItem(preparationKey, JSON.stringify(value)), { deep: true })

onMounted(() => {
  currentIndex.value = readStoredNumber(progressKey, 0, screencastSteps.length - 1)
  fontLevel.value = readStoredNumber(fontKey, 1, fontSizes.length - 1)
  try {
    const stored = JSON.parse(localStorage.getItem(preparationKey) || '[]')
    if (Array.isArray(stored) && stored.length === screencastPreparation.length) preparation.value = stored.map(Boolean)
  } catch {
    preparation.value = screencastPreparation.map(() => false)
  }
  document.addEventListener('visibilitychange', restoreWakeLock)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', restoreWakeLock)
  wakeLockRequested.value = false
  wakeLock.value?.release()
})
</script>

<style scoped>
.screencast-guide {
  width: min(1120px, 100%);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 22px 20px 110px;
  box-sizing: border-box;
  color: var(--text-1);
}

.guide-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.55fr);
  gap: 18px 28px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface-raised)), var(--surface-raised));
  box-shadow: var(--shadow-lg);
}

.guide-heading h1 { margin: 4px 0 5px; font-family: var(--font-display); font-size: clamp(30px, 5vw, 48px); line-height: 0.95; }
.guide-heading p { max-width: 680px; margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.5; }
.guide-kicker { color: var(--accent-soft); font-size: 10px; font-weight: 800; letter-spacing: 0.13em; }
.guide-status { align-self: end; }
.guide-progress-copy { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 7px; font-size: 12px; }
.guide-progress-copy span { color: var(--text-muted); }
.guide-progress { height: 6px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--text-1) 10%, transparent); }
.guide-progress span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 0.22s ease; }
.guide-controls { display: flex; grid-column: 1 / -1; flex-wrap: wrap; gap: 7px; }
.guide-controls button, .guide-footer button {
  min-height: 38px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text-1);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.guide-controls button:hover, .guide-controls button.active, .guide-footer button:hover { border-color: color-mix(in srgb, var(--accent) 65%, var(--border)); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
button:disabled { cursor: default; opacity: 0.38; }

.guide-preparation { margin: 18px 0; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-raised); }
.guide-preparation summary { display: flex; min-height: 48px; align-items: center; justify-content: space-between; gap: 14px; padding: 0 17px; color: var(--text-1); font-size: 13px; font-weight: 750; cursor: pointer; }
.guide-preparation summary strong { color: var(--accent-soft); }
.guide-preparation label { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 9px; padding: 10px 17px; border-top: 1px solid var(--border); color: var(--text-2); font-size: 13px; line-height: 1.45; }
.guide-preparation input { width: 17px; height: 17px; margin: 1px 0 0; accent-color: var(--accent); }

.guide-table-head { position: sticky; z-index: 5; top: 0; display: grid; grid-template-columns: 32% 68%; overflow: hidden; border: 1px solid var(--border); border-radius: 12px 12px 0 0; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(14px); }
.guide-table-head span { padding: 11px 16px; color: var(--text-muted); font-size: 10px; font-weight: 850; letter-spacing: 0.1em; text-transform: uppercase; }
.guide-table-head span + span { border-left: 1px solid var(--border); }
.guide-steps { border: 1px solid var(--border); border-top: 0; border-radius: 0 0 14px 14px; background: color-mix(in srgb, var(--surface-raised) 72%, var(--bg)); }
.guide-step { display: grid; grid-template-columns: 32% 68%; position: relative; cursor: pointer; scroll-margin: 90px; }
.guide-step + .guide-step { border-top: 1px solid var(--border); }
.guide-step::before { position: absolute; inset: 0 auto 0 0; width: 4px; background: transparent; content: ''; }
.guide-step.active { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.guide-step.active::before { background: var(--accent); }
.guide-step.completed { opacity: 0.68; }
.guide-step:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -2px; }
.step-meta { display: grid; grid-column: 1 / -1; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent); background: color-mix(in srgb, var(--surface) 42%, transparent); }
.step-number { color: var(--accent-soft); font-family: var(--font-display); font-size: 17px; font-weight: 700; }
.step-time { padding: 3px 6px; border-radius: 5px; background: color-mix(in srgb, var(--text-1) 8%, transparent); color: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.step-meta strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.step-state { color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.guide-step.active .step-state { color: var(--accent-soft); }
.step-action, .step-speech { min-width: 0; padding: 18px 18px 20px; }
.step-action { border-right: 1px solid var(--border); color: var(--text-2); }
.step-action ol { margin: 0; padding-left: 20px; }
.step-action li { padding-left: 3px; font-size: 13px; line-height: 1.55; }
.step-action li + li { margin-top: 8px; }
.step-action li::marker { color: var(--accent-soft); font-weight: 800; }
.step-speech p { margin: 0; font-family: var(--font-prose); font-size: var(--speech-size); line-height: 1.62; text-wrap: pretty; }
.step-speech p + p { margin-top: 0.75em; }
.step-criteria { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 15px; }
.step-criteria span { padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: 999px; color: var(--text-muted); font-size: 9px; font-weight: 750; text-transform: uppercase; }

.guide-footer { position: fixed; z-index: 10; right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); left: max(12px, env(safe-area-inset-left)); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; width: min(760px, calc(100% - 24px)); margin: auto; padding: 9px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--popover-bg) 92%, transparent); box-shadow: var(--shadow-lg); backdrop-filter: blur(16px); }
.guide-footer div { min-width: 0; display: flex; flex-direction: column; text-align: center; }
.guide-footer strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.guide-footer span { color: var(--text-muted); font-size: 9px; }

@media (max-width: 640px) {
  .screencast-guide { padding: 10px 8px 96px; }
  .guide-header { grid-template-columns: 1fr; gap: 15px; padding: 18px 16px; border-radius: 14px; }
  .guide-heading h1 { font-size: 36px; }
  .guide-status { grid-column: 1; }
  .guide-controls { gap: 5px; }
  .guide-controls button { min-height: 36px; padding: 0 10px; font-size: 11px; }
  .guide-table-head, .guide-step { grid-template-columns: 31% 69%; }
  .guide-table-head span { padding: 9px 8px; font-size: 8px; }
  .step-meta { grid-template-columns: auto auto minmax(0, 1fr); gap: 6px; padding: 8px; }
  .step-meta strong { font-size: 11px; }
  .step-state { display: none; }
  .step-action, .step-speech { padding: 13px 9px 16px; }
  .step-action { padding-left: 10px; }
  .step-action ol { padding-left: 15px; }
  .step-action li { padding-left: 0; font-size: 11px; line-height: 1.5; }
  .step-action li + li { margin-top: 7px; }
  .step-speech p { line-height: 1.58; }
  .step-criteria { gap: 3px; margin-top: 11px; }
  .step-criteria span { padding: 3px 5px; font-size: 7px; }
  .guide-footer { bottom: max(7px, env(safe-area-inset-bottom)); width: calc(100% - 14px); }
  .guide-footer button { min-height: 40px; padding: 0 10px; font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .guide-progress span { transition: none; }
}
</style>
