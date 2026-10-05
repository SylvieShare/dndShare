<template>
  <figure class="karmic-distribution" :aria-label="`Распределение вероятностей d20: ${name}`">
    <figcaption><span>Распределение d20</span><output v-if="selected != null">{{ selected + 1 }} <span>·</span> {{ percent(probabilities[selected]) }}</output><span v-else class="distribution-neutral">Обычный шанс · 5%</span></figcaption>
    <svg ref="chart" :viewBox="`0 0 ${width} ${height}`" :height="height" role="group" tabindex="0"
      :aria-label="`Вероятности d20 для ${name}. Стрелки выбирают значение.`" @pointermove="pointAt" @pointerdown="pointAt"
      @pointerleave="!focused && (selected = null)" @focus="focused = true; selected ??= 0" @blur="focused = false; selected = null" @keydown="navigate">
      <title>{{ `Распределение d20: ${name}` }}</title><desc>{{ summary }}</desc>
      <defs><linearGradient :id="fillId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22" /><stop offset="1" stop-color="var(--accent)" stop-opacity=".015" /></linearGradient></defs>
      <g class="distribution-grid"><line v-for="tick in ticks" :key="tick" :x1="left" :x2="width - right" :y1="y(tick)" :y2="y(tick)" :class="{ 'distribution-baseline': tick === .05 }" /></g>
      <g class="distribution-axis"><text v-for="tick in ticks" :key="tick" :x="left - 7" :y="y(tick) + 4" text-anchor="end">{{ percent(tick, 0) }}</text><text v-for="face in [1, 5, 10, 15, 20]" :key="face" :x="x(face - 1)" :y="height - 8" text-anchor="middle">{{ face }}</text></g>
      <path class="distribution-area" :d="area" :fill="`url(#${fillId})`" />
      <g class="distribution-bars"><rect v-for="(chance, index) in probabilities" :key="index" :x="x(index) - barWidth / 2" :y="y(chance)" :width="barWidth" :height="bottom - y(chance)" rx="2" /></g>
      <path class="distribution-curve" :d="curve" />
      <g class="distribution-points"><circle v-for="(chance, index) in probabilities" :key="index" :cx="x(index)" :cy="y(chance)" r="2" /></g>
      <g v-if="selected != null" class="distribution-selected"><line :x1="x(selected)" :x2="x(selected)" :y1="top" :y2="bottom" /><circle :cx="x(selected)" :cy="y(probabilities[selected])" r="5" /></g>
      <rect class="distribution-hit" :x="left" :y="top" :width="width - left - right" :height="bottom - top" />
    </svg>
    <div class="distribution-extremes"><span><span class="distribution-face">1</span>{{ percent(probabilities[0]) }}</span><span>Один d20 · до бонусов</span><span><span class="distribution-face">20</span>{{ percent(probabilities[19]) }}</span></div>
  </figure>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
const props = defineProps({ name: String, probabilities: { type: Array, default: () => Array(20).fill(.05) } })
const chart = ref(null), width = ref(600), selected = ref(null), focused = ref(false)
const fillId = `karma-fill-${useId()}`
const height = 168, left = 34, right = 8, top = 12, bottom = height - 28
const maximum = computed(() => Math.max(.1, Math.ceil(Math.max(...props.probabilities) * 20) / 20))
const ticks = computed(() => [0, .05, maximum.value])
const step = computed(() => (width.value - left - right) / 20)
const barWidth = computed(() => Math.max(2, step.value * .35))
const x = index => left + step.value * (index + .5)
const y = chance => bottom - chance / maximum.value * (bottom - top)
const curve = computed(() => props.probabilities.map((chance, index) => `${index ? 'L' : 'M'}${x(index)},${y(chance)}`).join(' '))
const area = computed(() => `${curve.value} L${x(19)},${bottom} L${x(0)},${bottom} Z`)
const percent = (value, digits = 2) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value * 100)}%`
const summary = computed(() => props.probabilities.map((chance, index) => `${index + 1}: ${percent(chance)}`).join('; '))
function pointAt(event) {
  if (!chart.value) return
  const bounds = chart.value.getBoundingClientRect()
  selected.value = Math.max(0, Math.min(19, Math.floor((event.clientX - bounds.left - left) / step.value)))
}
function navigate(event) {
  const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }
  if (event.key in moves) selected.value = Math.max(0, Math.min(19, (selected.value ?? 0) + moves[event.key]))
  else if (event.key === 'Home') selected.value = 0
  else if (event.key === 'End') selected.value = 19
  else if (event.key === 'Escape') selected.value = null
  else return
  event.preventDefault(); event.stopPropagation()
}
let observer
onMounted(() => {
  const measure = () => { width.value = Math.max(120, chart.value?.getBoundingClientRect().width || 600) }
  measure(); observer = new ResizeObserver(measure); observer.observe(chart.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<style scoped>
.karmic-distribution { margin: 0; min-width: 0; }
figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 6px 14px; min-height: 21px; margin-bottom: 2px; font-size: 12px; }
figcaption > span:first-child { font-weight: 600; color: var(--text-2); }
output { color: var(--text-1); font-variant-numeric: tabular-nums; } output span { margin-inline: 3px; color: var(--text-muted); }
.distribution-neutral { color: var(--text-muted); }
svg { display: block; width: 100%; overflow: visible; border-radius: var(--r-sm); }
svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.distribution-grid line { stroke: var(--border); stroke-width: 1; opacity: .55; }
.distribution-grid .distribution-baseline { stroke: var(--text-muted); stroke-dasharray: 4 5; opacity: .5; }
.distribution-axis text { fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.distribution-bars rect { fill: var(--accent); opacity: .13; }
.distribution-curve { fill: none; stroke: var(--accent-soft); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.distribution-points circle { fill: var(--accent-soft); }
.distribution-selected line { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 2 4; opacity: .6; }
.distribution-selected circle { fill: var(--accent-soft); stroke: var(--surface); stroke-width: 3; }
.distribution-hit { fill: transparent; }
.distribution-extremes { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 11px; }
.distribution-extremes > span { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.distribution-extremes > span:first-child, .distribution-extremes > span:last-child { color: var(--text-2); }
.distribution-face { display: grid; place-items: center; min-width: 22px; height: 22px; border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-1); font-size: 12px; font-weight: 600; }
@media (max-width: 520px) { .distribution-extremes > span:nth-child(2) { order: 1; flex-basis: 100%; justify-content: center; } }
@media (prefers-reduced-motion: reduce) { .distribution-curve { transition: none; } }
</style>
