<template>
  <div class="illustrated-choice">
    <div class="illustrated-choice-heading">
      <h1 class="illustrated-choice-title">{{ title }}</h1>
      <button v-if="selected" type="button" class="illustrated-choice-back" @click="clearSelection">
        <span class="illustrated-choice-back-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </span>
        <span><span class="illustrated-choice-back-label">Назад</span><span class="illustrated-choice-back-note">{{ backText }}</span></span>
      </button>
    </div>
    <LoadingState v-if="loading" :label="loadingText" />
    <p v-else-if="empty" class="illustrated-choice-muted">{{ emptyText }}</p>
    <div v-else ref="stage" class="illustrated-choice-stage" :class="{ 'illustrated-choice-stage--selected': selected }">
      <div class="illustrated-choice-list" :class="{ 'illustrated-choice-list--two-column': twoColumn && !selected }">
        <slot name="cards" />
      </div>
      <div v-if="selected" :key="selectionKey" class="illustrated-choice-details">
        <slot name="details" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
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
let listScrollTop = 0

watch([() => props.selected, () => props.selectionKey], ([selected, key], [wasSelected]) => {
  if (!selected && !wasSelected) return
  const scroller = stage.value?.closest('.cc-main')
  if (!scroller) return
  if (selected && !wasSelected) listScrollTop = scroller.scrollTop
  nextTick(() => {
    if (!scroller.isConnected || props.selected !== selected || props.selectionKey !== key) return
    scroller.scrollTo({ top: selected ? 0 : listScrollTop, behavior: 'instant' })
  })
}, { flush: 'pre' })

function clearSelection() {
  const card = stage.value?.querySelector('button[aria-pressed="true"]')
  emit('clear')
  nextTick(() => {
    if (!props.selected) card?.focus({ preventScroll: true })
  })
}
</script>

<style scoped>
.illustrated-choice { display: flex; flex-direction: column; gap: 12px; overflow-anchor: none; }
.illustrated-choice-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.illustrated-choice-title { position: relative; width: fit-content; margin: 0 0 6px; padding-bottom: 9px; color: var(--text-1); font-family: var(--font-display); font-size: clamp(28px, 3.2vw, 36px); font-weight: 700; letter-spacing: .01em; line-height: 1; }
.illustrated-choice-title::after { content: ''; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 18%, transparent)); }
.illustrated-choice-muted { margin: 0; color: var(--text-muted); font-size: 13px; }
.illustrated-choice-stage { display: flex; flex-direction: column; gap: 12px; }
.illustrated-choice-stage--selected { animation: illustrated-choice-appear .18s ease-out; }
@keyframes illustrated-choice-appear { from { opacity: .45; } }
.illustrated-choice-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.illustrated-choice-list--two-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.illustrated-choice-details { display: flex; flex-direction: column; gap: 12px; }
.illustrated-choice-back { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 6px 10px 6px 6px; color: var(--text-2); background: color-mix(in srgb, var(--bg) 78%, transparent); border: 1px solid color-mix(in srgb, var(--border) 78%, transparent); box-shadow: var(--shadow-sm); border-radius: var(--r-md); font: inherit; text-align: left; cursor: pointer; transition: color .15s, background .15s, border-color .15s, transform .18s cubic-bezier(.22,1,.36,1); }
.illustrated-choice-back:hover { color: var(--text-1); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); border-color: color-mix(in srgb, var(--accent) 24%, var(--border)); transform: translateX(-2px); }
.illustrated-choice-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.illustrated-choice-back-icon { width: 31px; height: 31px; flex-shrink: 0; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border-radius: 10px; }
.illustrated-choice-back-icon svg { width: 17px; height: 17px; }
.illustrated-choice-back > span:last-child { display: flex; flex-direction: column; gap: 1px; }
.illustrated-choice-back-label { font-size: 13px; font-weight: 700; line-height: 1.1; }
.illustrated-choice-back-note { color: var(--text-muted); font-size: 10px; line-height: 1.1; }
@media (prefers-reduced-motion: reduce) {
  .illustrated-choice-stage--selected { animation: none; }
  .illustrated-choice-back { transition: none; }
}
@media (max-width: 700px) { .illustrated-choice-list--two-column { grid-template-columns: minmax(0, 1fr); } }
</style>
