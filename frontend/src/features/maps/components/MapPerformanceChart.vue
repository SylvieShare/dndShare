<template>
  <svg
    class="map-performance-chart"
    viewBox="0 0 300 132"
    role="img"
    :aria-label="`${metric === 'gpu' ? 'GPU' : 'CPU'}: время кадра по этапам за 30 секунд`"
  >
    <text x="0" y="10">{{ Math.ceil(chart.max) }}</text>
    <text x="9" y="113">0</text>
    <line x1="24" y1="112" x2="295" y2="112" />
    <line
      class="map-performance-budget"
      x1="24"
      :y1="chart.budgetY"
      x2="295"
      :y2="chart.budgetY"
    />
    <text x="292" :y="chart.budgetY - 3" text-anchor="end">16,7 мс</text>
    <path
      v-for="part in parts"
      :key="part.id"
      :d="chart.paths[part.id]"
      :fill="part.color"
    />
    <rect
      v-for="column in chart.columns"
      :key="column.x"
      :x="column.x"
      y="8"
      width="4.5"
      height="104"
      fill="transparent"
    >
      <title>{{ column.title }}</title>
    </rect>
    <text x="24" y="128">−30 с</text>
    <text x="295" y="128" text-anchor="end">Сейчас</text>
  </svg>
</template>
<script setup>
import { computed } from "vue";
import { performanceChart } from "../lib/renderPerformance";
const props = defineProps({
  history: { type: Array, default: () => [] },
  metric: String,
  parts: Array,
});
const chart = computed(() =>
  performanceChart(props.history, props.metric, props.parts),
);
</script>
<style scoped>
.map-performance-chart {
  width: 100%;
  display: block;
  min-height: 120px;
  border-radius: var(--r-sm);
  background: var(--bg);
}
text {
  fill: var(--text-muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
line {
  stroke: var(--border);
  stroke-width: 0.7;
}
.map-performance-budget {
  stroke: var(--text-muted);
  stroke-dasharray: 3 3;
  opacity: 0.6;
}
</style>
