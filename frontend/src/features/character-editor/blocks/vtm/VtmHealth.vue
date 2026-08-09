<template>
  <div class="health-track">
    <div class="health-row" v-for="(level, i) in LEVELS" :key="i">
      <span class="health-penalty">{{ level.penalty }}</span>
      <span class="health-label">{{ level.label }}</span>
      <span
        class="health-box"
        :class="`dmg-${damage[i] || 'empty'}`"
        @click="cycle(i)"
      >{{ SYMBOLS[damage[i] || ''] }}</span>
    </div>
    <div class="health-legend">
      <span class="legend-item bashing">/ поверхностный</span>
      <span class="legend-item lethal">X смертельный</span>
      <span class="legend-item aggravated">* агравированный</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const LEVELS = [
  { label: 'Царапина',        penalty: '' },
  { label: 'Травма',          penalty: '-1' },
  { label: 'Ранение',         penalty: '-1' },
  { label: 'Тяжёлое ранение', penalty: '-2' },
  { label: 'Изуродован',      penalty: '-2' },
  { label: 'Искалечен',       penalty: '-5' },
  { label: 'Недееспособен',   penalty: '✕' },
]
const CYCLE   = ['', 'bashing', 'lethal', 'aggravated']
const SYMBOLS = { '': '', bashing: '/', lethal: 'X', aggravated: '*' }

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const damage = computed(() => props.value || Array(7).fill(''))

function cycle(i) {
  const cur = damage.value[i] || ''
  const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]
  const updated = [...damage.value]
  updated[i] = next
  emit('update:value', props.block.id, updated)
}
</script>

<style scoped>
.health-track {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.health-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-penalty {
  width: 22px;
  text-align: right;
  font-size: 11px;
  color: var(--danger);
  font-weight: 700;
  flex-shrink: 0;
}

.health-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-2, var(--text-muted));
}

.health-box {
  width: 26px;
  height: 26px;
  border: 2px solid var(--surface-active);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s;
  user-select: none;
}

.health-box { cursor: pointer; }
.health-box:hover { border-color: var(--text-muted); }

.dmg-empty      { color: transparent; }
.dmg-bashing    { border-color: var(--warning); color: var(--warning); }
.dmg-lethal     { border-color: var(--danger); color: var(--danger); }
.dmg-aggravated { border-color: var(--bg); color: var(--danger); background: var(--bg); }

.health-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
}

.legend-item {
  font-size: 10px;
  letter-spacing: 0.04em;
}

.legend-item.bashing    { color: var(--warning); }
.legend-item.lethal     { color: var(--danger); }
.legend-item.aggravated { color: var(--danger); }
</style>
