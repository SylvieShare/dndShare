<template>
  <div class="sa">
    <MultiToggle
      :options="methodOptions"
      :model-value="state.statMethod"
      block
      @update:model-value="$emit('method', $event)"
    />

    <p class="sa-hint">{{ hint }}</p>

    <div v-if="state.statMethod === 'pointbuy'" class="sa-budget" :class="{ over: pointsLeft < 0 }">
      Очки: {{ pointsLeft }} / {{ budget }}
    </div>

    <div v-if="state.statMethod === 'roll' && !state.rollPool.length" class="sa-roll-cta">
      <button class="sa-btn" @click="$emit('roll')">🎲 Бросить 4d6</button>
    </div>

    <div v-else class="sa-grid">
      <div v-for="stat in stats" :key="stat" class="sa-row">
        <span class="sa-stat">{{ stat }}</span>

        <template v-if="state.statMethod === 'pointbuy'">
          <button class="sa-step" :disabled="(state.scores[stat] ?? 8) <= 8" @click="bump(stat, -1)">−</button>
          <span class="sa-val">{{ state.scores[stat] ?? 8 }}</span>
          <button class="sa-step" :disabled="(state.scores[stat] ?? 8) >= 15 || pointsLeft <= costStep(stat)" @click="bump(stat, 1)">+</button>
        </template>

        <select v-else class="sa-select" :value="state.scores[stat] ?? ''" @change="assign(stat, $event.target.value)">
          <option value="">—</option>
          <option v-for="(v, i) in pool" :key="i" :value="v" :disabled="isUsed(v, stat)">{{ v }}</option>
        </select>

        <span class="sa-final">→ {{ finalScores[stat] }}<span v-if="asiFor(stat)" class="sa-asi"> (+{{ asiFor(stat) }})</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MultiToggle from '@/shared/ui/MultiToggle.vue'
import { POINT_BUY_BUDGET, STANDARD_ARRAY, pointCost } from '@/features/character-list/composables/useDndCreateWizard'

const props = defineProps({
  state: { type: Object, required: true },
  stats: { type: Array, required: true },
  finalScores: { type: Object, required: true },
  grantsAsi: { type: Array, default: () => [] },
  pointsLeft: { type: Number, default: 0 },
})
defineEmits(['method', 'roll'])

const budget = POINT_BUY_BUDGET
const methodOptions = [
  { value: 'array', label: 'Стандарт' },
  { value: 'pointbuy', label: 'Очки' },
  { value: 'roll', label: 'Бросок' },
]
const hint = computed(() => ({
  array: 'Стандартный набор: 15 · 14 · 13 · 12 · 10 · 8 — раскидайте по характеристикам.',
  pointbuy: 'Покупка за 27 очков, каждая характеристика 8–15.',
  roll: 'Бросьте 4d6 со сбросом младшего ×6 и раскидайте результаты.',
}[props.state.statMethod] || ''))

const pool = computed(() => (props.state.statMethod === 'roll' ? props.state.rollPool : STANDARD_ARRAY))

function asiFor(stat) {
  return (props.grantsAsi || []).filter((a) => a.stat === stat).reduce((s, a) => s + a.bonus, 0)
}

// pool methods: each value assignable once.
function isUsed(value, stat) {
  return props.stats.some((s) => s !== stat && Number(props.state.scores[s]) === Number(value))
}
function assign(stat, raw) {
  props.state.scores[stat] = raw === '' ? null : Number(raw)
}

// point-buy
function costStep(stat) {
  const cur = props.state.scores[stat] ?? 8
  return pointCost(Math.min(cur + 1, 15)) - pointCost(cur)
}
function bump(stat, dir) {
  const cur = props.state.scores[stat] ?? 8
  const next = Math.max(8, Math.min(15, cur + dir))
  props.state.scores[stat] = next
}
</script>

<style scoped>
.sa { display: flex; flex-direction: column; gap: 12px; }
.sa-hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.sa-budget { font-size: 13px; font-weight: 600; color: var(--text-2); }
.sa-budget.over { color: var(--danger, #e5484d); }
.sa-roll-cta { display: flex; justify-content: center; padding: 8px 0; }
.sa-btn {
  background: var(--accent); color: #fff; border: none; border-radius: 8px;
  padding: 9px 18px; font: inherit; font-weight: 600; cursor: pointer;
}
.sa-grid { display: flex; flex-direction: column; gap: 8px; }
.sa-row { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 10px; }
.sa-stat { font-weight: 700; color: var(--text-1); }
.sa-select {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 8px;
  color: var(--text-1); font: inherit; padding: 7px 10px; outline: none;
}
.sa-step {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--input-border);
  background: var(--input-bg); color: var(--text-1); cursor: pointer; font-size: 16px; line-height: 1;
}
.sa-step:disabled { opacity: 0.4; cursor: default; }
.sa-val { min-width: 28px; text-align: center; font-weight: 700; color: var(--text-1); }
.sa-final { font-size: 13px; color: var(--text-muted); justify-self: end; }
.sa-asi { color: var(--success, #5aaf72); }
</style>
