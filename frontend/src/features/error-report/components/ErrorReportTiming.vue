<template>
  <section class="report-timing" aria-label="Время работы над репортом">
    <div class="report-timing__heading">
      <h3>Время работы</h3>
      <span v-if="activeLabel">Сейчас: {{ activeLabel }}</span>
    </div>
    <template v-if="timing">
      <SegmentDonutChart :segments="segments" :format-value="formatReportDuration" :size="160"
        :show-percent="false" aria-label="Время по этапам работы">
        <template #center>
          <span class="report-timing__total">{{ formatReportDuration(total) }}</span>
          <span>на работу</span>
        </template>
      </SegmentDonutChart>
      <p class="report-timing__waiting">До начала работы <strong>{{ formatReportDuration(timing.beforeWorkMs) }}</strong></p>
      <p class="report-timing__note">Время по отметкам этапов. Повторные проходы суммируются; паузы и ожидание ответа исключены.</p>
      <p v-if="timing.includesBuildInTest" class="report-timing__note">В старых отметках сборка учтена в тестировании. Отдельного замера для неё нет.</p>
    </template>
    <p v-else class="report-timing__note">Замеры появятся, когда чат начнёт отмечать этапы работы.</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { SegmentDonutChart } from '@sylvieshare/share-ui'
import { formatReportDuration, reportTimingSegments, reportWorkPhases } from '../lib/errorReportTiming'

const props = defineProps({ timing: { type: Object, default: null } })
const elapsed = ref(0)
let timer
const remaining = computed(() => Date.parse(props.timing?.activeUntil) - Date.parse(props.timing?.snapshotAt))
const segments = computed(() => reportTimingSegments(props.timing, elapsed.value))
const total = computed(() => segments.value.reduce((sum, segment) => sum + segment.value, 0))
const activeLabel = computed(() => remaining.value > elapsed.value
  ? reportWorkPhases.find(phase => phase.key === props.timing?.activePhase)?.label : '')

watch(() => props.timing, timing => {
  clearInterval(timer)
  elapsed.value = 0
  const receivedAt = performance.now()
  if (timing?.activePhase && remaining.value > 0) {
    timer = setInterval(() => {
      elapsed.value = performance.now() - receivedAt
      if (elapsed.value >= remaining.value) clearInterval(timer)
    }, 1000)
  }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.report-timing { display: grid; gap: 18px; padding-block: 20px; color: var(--text-1); }
.report-timing__heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.report-timing__heading h3 { margin: 0; font-size: 15px; }
.report-timing__heading > span { font-size: 12px; color: var(--text-2); }
.report-timing__total { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.2; }
.report-timing__waiting { display: flex; justify-content: space-between; gap: 16px; margin: 0; font-size: 12px; color: var(--text-2); }
.report-timing__waiting strong { white-space: nowrap; font-variant-numeric: tabular-nums; }
.report-timing__note { margin: 0; font-size: 11px; line-height: 1.5; color: var(--text-muted); }
</style>
