<template>
  <nav class="journal-chapters" aria-label="Разделы дневника">
    <button v-if="editable" type="button" class="journal-chapters-new" :disabled="disabled" @click="$emit('create')"><Plus :size="16" /> Новый раздел</button>
    <div ref="strip" class="journal-chapters-strip" role="tablist" aria-label="Выбор раздела">
      <button v-for="(section, index) in sections" :key="section.id" type="button" role="tab" :data-section-id="section.id"
        :aria-selected="section.id === selectedId" :tabindex="section.id === selectedId ? 0 : -1" :disabled="disabled" :title="section.title || `Раздел ${index + 1}`"
        :class="{ active: section.id === selectedId }" @click="$emit('select', section.id)" @keydown="navigate($event, index)">
        <span class="journal-chapter-number">{{ String(index + 1).padStart(2, '0') }}</span>
        <span>{{ section.title || `Раздел ${index + 1}` }}</span><small v-if="section.date">{{ section.date }}</small>
      </button>
    </div>
  </nav>
</template>
<script setup>
import { nextTick, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
const props = defineProps({ sections: { type: Array, default: () => [] }, selectedId: String, editable: Boolean, disabled: Boolean })
const emit = defineEmits(['select', 'create'])
const strip = ref(null)
function reveal() {
  const active = strip.value?.querySelector('[aria-selected="true"]')
  if (!active) return
  const left = active.offsetLeft
  if (left < strip.value.scrollLeft) strip.value.scrollLeft = left
  else if (left + active.offsetWidth > strip.value.scrollLeft + strip.value.clientWidth) strip.value.scrollLeft = left + active.offsetWidth - strip.value.clientWidth
}
watch(() => props.selectedId, () => nextTick(reveal), { immediate: true })
function navigate(event, index) {
  const count = props.sections.length
  const target = ({ ArrowRight: (index + 1) % count, ArrowLeft: (index + count - 1) % count, Home: 0, End: count - 1 })[event.key]
  if (target == null || props.disabled) return
  event.preventDefault()
  emit('select', props.sections[target].id)
  nextTick(() => strip.value?.querySelectorAll('[role="tab"]')[target]?.focus({ preventScroll: true }))
}
</script>
<style scoped>
.journal-chapters { display: flex; align-items: stretch; gap: 14px; min-width: 0; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.journal-chapters-new { display: inline-flex; flex: none; align-items: center; gap: 8px; padding: 10px 14px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--accent); font: 600 12px var(--font-ui); cursor: pointer; }
.journal-chapters-strip { position: relative; display: flex; min-width: 0; gap: 8px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 4px; }
.journal-chapters-strip button { display: flex; flex: none; align-items: center; gap: 10px; max-width: 320px; padding: 12px 16px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text-muted); font: 600 13px var(--font-ui); cursor: pointer; white-space: nowrap; }
.journal-chapters-strip button > span:not(.journal-chapter-number) { overflow: hidden; text-overflow: ellipsis; }
.journal-chapters-strip button.active { color: var(--text-1); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.journal-chapter-number { color: var(--accent-soft); font-family: var(--font-ui); font-size: 12px; font-variant-numeric: tabular-nums; }
.journal-chapters-strip small { font-size: 10px; color: var(--text-muted); }
button:hover { color: var(--text-1); } button:disabled { opacity: .5; cursor: default; }
@media (max-width: 720px) { .journal-chapters { gap: 8px; } .journal-chapters-new { max-width: 110px; padding: 9px; font-size: 11px; text-align: left; } .journal-chapters-strip button { max-width: 220px; padding: 10px; } }
</style>
