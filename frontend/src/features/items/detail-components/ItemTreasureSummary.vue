<template>
  <DetailSection v-if="treasure" label="Генератор сокровищ">
    <template #icon><Gem /></template>
    <BaseTile framed color="var(--warning)" class="treasure-summary">
      <div class="treasure-summary-status">
        <CircleCheck :size="18" aria-hidden="true" />
        <span>Участвует в случайном подборе</span>
      </div>
      <div class="treasure-summary-metrics">
        <div class="treasure-summary-levels">
          <span>Уровень группы</span>
          <strong>{{ levelRange }}</strong>
          <small>{{ allLevels ? 'На любом уровне' : 'В этом диапазоне предмет может выпасть' }}</small>
        </div>
        <div class="treasure-summary-weight" title="Относительный вес среди подходящих предметов. Вес 20 даёт вдвое больше шансов, чем 10; итоговый шанс зависит от набора кандидатов.">
          <span>Вес выпадения</span>
          <strong>{{ treasure.weight ?? '—' }}</strong>
          <small>Больше вес — чаще выпадает</small>
        </div>
      </div>
    </BaseTile>
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { CircleCheck, Gem } from '@lucide/vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
const props = defineProps({ treasure: Object })
const allLevels = computed(() => Number(props.treasure?.min_level) === 1 && Number(props.treasure?.max_level) === 20)
const levelRange = computed(() => {
  const { min_level: min, max_level: max } = props.treasure || {}
  return min != null && max != null ? (Number(min) === Number(max) ? String(min) : `${min}–${max}`) : 'Не задан'
})
</script>
<style scoped>
.treasure-summary { display: flex; flex-direction: column; gap: 16px; padding: 16px 18px; }
.treasure-summary-status { display: flex; align-items: center; gap: 8px; color: var(--warning); font-size: 13px; font-weight: 600; }
.treasure-summary-status svg { flex: none; }
.treasure-summary-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
.treasure-summary-metrics > div { display: flex; flex-direction: column; gap: 5px; }
.treasure-summary-metrics span { color: var(--text-2); font-size: 11px; }
.treasure-summary-metrics strong { color: var(--text-1); font-size: 28px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.treasure-summary-metrics small { color: var(--text-muted); font-size: 11px; line-height: 1.45; }
@media (max-width: 420px) { .treasure-summary-metrics { grid-template-columns: minmax(0, 1fr); } }
</style>
