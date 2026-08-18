<template>
  <div class="illustrated-choice">
    <h1 class="illustrated-choice-title">{{ title }}</h1>
    <p v-if="loading" class="illustrated-choice-muted">{{ loadingText }}</p>
    <p v-else-if="empty" class="illustrated-choice-muted">{{ emptyText }}</p>
    <template v-else>
      <div ref="stage" class="illustrated-choice-stage">
        <Transition name="illustrated-back">
          <button v-if="selected" type="button" class="illustrated-choice-back" @click="clearSelection">
            <span class="illustrated-choice-back-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            </span>
            <span><span class="illustrated-choice-back-label">Назад</span><span class="illustrated-choice-back-note">{{ backText }}</span></span>
          </button>
        </Transition>
        <TransitionGroup
          name="illustrated-list"
          tag="div"
          class="illustrated-choice-list"
          :class="{ 'illustrated-choice-list--two-column': twoColumn && !selected }"
        >
          <slot name="cards" />
        </TransitionGroup>
      </div>

      <Transition name="illustrated-details">
        <div v-if="selected" :key="selectionKey" class="illustrated-choice-details">
          <slot name="details" />
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  selected: { type: Boolean, default: false },
  selectionKey: { type: [String, Number], default: null },
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  loadingText: { type: String, default: 'Загрузка справочника…' },
  emptyText: { type: String, default: 'В справочнике пока нет вариантов.' },
  backText: { type: String, default: 'К выбору' },
  twoColumn: { type: Boolean, default: false },
})
const emit = defineEmits(['clear'])
const stage = ref(null)
let scrollTimer = null

watch(() => props.selectionKey, (value, previous) => {
  if (value == null || value === previous) return
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    requestAnimationFrame(() => stage.value?.closest('.cc-main')?.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }))
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 560)
})

function clearSelection() {
  clearTimeout(scrollTimer)
  scrollTimer = null
  const scroller = stage.value?.closest('.cc-main')
  const scrollTop = scroller?.scrollTop || 0
  emit('clear')
  if (scroller && scrollTop > 0) {
    nextTick(() => requestAnimationFrame(() => scroller.scrollTo({ top: scrollTop, behavior: 'auto' })))
  }
}
</script>

<style scoped>
.illustrated-choice { display: flex; flex-direction: column; gap: 12px; }
.illustrated-choice-title { position: relative; width: fit-content; margin: 0 0 6px; padding-bottom: 9px; color: var(--text-1); font-family: var(--font-display); font-size: clamp(28px, 3.2vw, 36px); font-weight: 700; letter-spacing: .01em; line-height: 1; }
.illustrated-choice-title::after { content: ''; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 18%, transparent)); }
.illustrated-choice-muted { margin: 0; color: var(--text-muted); font-size: 13px; }
.illustrated-choice-stage { position: relative; overflow-anchor: none; }
.illustrated-choice-list { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.illustrated-choice-list--two-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.illustrated-choice-details { display: flex; flex-direction: column; gap: 12px; overflow-anchor: none; }
.illustrated-choice-back { position: absolute; z-index: 5; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 9px; padding: 6px 10px 6px 6px; color: var(--text-2); background: color-mix(in srgb, var(--bg) 78%, transparent); border: 1px solid color-mix(in srgb, var(--border) 78%, transparent); box-shadow: var(--shadow-sm); backdrop-filter: blur(12px); border-radius: var(--r-md); font: inherit; text-align: left; cursor: pointer; transition: color .15s, background .15s, border-color .15s, transform .18s cubic-bezier(.22,1,.36,1); }
.illustrated-choice-back:hover { color: var(--text-1); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); border-color: color-mix(in srgb, var(--accent) 24%, var(--border)); transform: translateX(-2px); }
.illustrated-choice-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.illustrated-choice-back-icon { width: 31px; height: 31px; flex-shrink: 0; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border-radius: 10px; }
.illustrated-choice-back-icon svg { width: 17px; height: 17px; }
.illustrated-choice-back > span:last-child { display: flex; flex-direction: column; gap: 1px; }
.illustrated-choice-back-label { font-size: 13px; font-weight: 700; line-height: 1.1; }
.illustrated-choice-back-note { color: var(--text-muted); font-size: 10px; line-height: 1.1; }
.illustrated-list-move { transition: transform .52s cubic-bezier(.22,1,.36,1); }
.illustrated-list-enter-active { transition: opacity .34s .12s ease, transform .48s .08s cubic-bezier(.22,1,.36,1), filter .34s .12s ease; }
.illustrated-list-leave-active { position: absolute; z-index: 0; left: 0; right: 0; transition: opacity .2s ease, transform .32s cubic-bezier(.4,0,1,1), filter .24s ease; }
.illustrated-list-enter-from { opacity: 0; transform: translateY(18px) scale(.965); filter: blur(4px); }
.illustrated-list-leave-to { opacity: 0; transform: translateY(8px) scale(.97); filter: blur(4px); }
.illustrated-details-enter-active { transition: opacity .34s .24s ease, transform .46s .2s cubic-bezier(.22,1,.36,1); }
.illustrated-details-leave-active { transition: opacity .16s ease, transform .22s cubic-bezier(.4,0,1,1); }
.illustrated-details-enter-from { opacity: 0; transform: translateY(18px); }
.illustrated-details-leave-to { opacity: 0; transform: translateY(8px); }
.illustrated-back-enter-active { transition: opacity .28s .18s ease, transform .38s .14s cubic-bezier(.22,1,.36,1); }
.illustrated-back-leave-active { transition: opacity .14s ease, transform .2s cubic-bezier(.4,0,1,1); }
.illustrated-back-enter-from, .illustrated-back-leave-to { opacity: 0; transform: translateX(-10px); }
@media (prefers-reduced-motion: reduce) { .illustrated-list-move, .illustrated-list-enter-active, .illustrated-list-leave-active, .illustrated-details-enter-active, .illustrated-details-leave-active, .illustrated-back-enter-active, .illustrated-back-leave-active { transition: none; } }
@media (max-width: 700px) { .illustrated-choice-list--two-column { grid-template-columns: minmax(0, 1fr); } }
</style>
