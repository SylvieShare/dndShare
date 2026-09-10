<template>
  <span v-if="source || audit.length" class="diary-meta" @click.stop @keydown.esc.stop="hide">
    <button type="button" aria-label="Информация о записи"
      @mouseenter="show('audit', $event)" @mouseleave="hide" @focus="show('audit', $event)" @blur="hide" @click="show('audit', $event)">
      <Info :size="16" />
    </button>
    <ItemTooltip v-if="tooltip" :title="tooltip.kind === 'source' ? 'Из сценария' : 'История записи'"
      :x="tooltip.x" :top="tooltip.top" :bottom="tooltip.bottom" :width="320">
      <template #details>
        <div v-if="tooltip.kind === 'source'" class="diary-meta-source">{{ source }}</div>
        <dl v-else class="diary-meta-audit">
          <div v-for="row in audit" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd><time :datetime="row.at">{{ formatDiaryTimestamp(row.at) }}</time><strong>{{ row.author }}</strong></dd>
          </div>
        </dl>
        <div v-if="source" class="diary-meta-source">{{ source }}</div>
      </template>
    </ItemTooltip>
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Info } from '@lucide/vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { diaryAuditRows, diarySourceLabel, formatDiaryTimestamp } from '../lib/diaryMetadata'

const props = defineProps({ event: { type: Object, required: true } })
const source = computed(() => diarySourceLabel(props.event))
const audit = computed(() => diaryAuditRows(props.event))
const tooltip = ref(null)
function show(kind, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const above = rect.top > 230
  tooltip.value = {
    kind, x: rect.right - 320,
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  }
}
function hide() { tooltip.value = null }
onMounted(() => {
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', hide, true)
  window.removeEventListener('resize', hide)
})
</script>

<style scoped>
.diary-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 2px; }
.diary-meta button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-muted); cursor: help; }
@media (pointer: coarse) { .diary-meta button { width: 40px; height: 40px; } }
.diary-meta button span { overflow-wrap: anywhere; }
.diary-meta button time { white-space: nowrap; font-variant-numeric: tabular-nums; }
.diary-meta button:hover, .diary-meta button:focus-visible { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.diary-meta-source { color: var(--text-2); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.diary-meta-audit { display: flex; flex-direction: column; gap: 12px; width: 100%; margin: 0; font-size: 12px; line-height: 1.5; }
.diary-meta-audit > div { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 10px; }
.diary-meta-audit dt { color: var(--text-muted); }
.diary-meta-audit dd { display: flex; flex-direction: column; gap: 3px; margin: 0; color: var(--text-2); }
.diary-meta-audit strong { font-weight: 600; color: var(--text-1); overflow-wrap: anywhere; }
</style>
