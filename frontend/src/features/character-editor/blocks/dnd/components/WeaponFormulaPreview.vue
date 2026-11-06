<template>
  <div class="weapon-formula" :aria-label="scope === 'attack' ? 'Итоговая формула атаки' : 'Итоговая формула урона'">
    <div v-for="(row, index) in parsed" :key="index" class="weapon-formula-row">
      <small>{{ row.source }}</small>
      <div class="weapon-formula-terms">
        <template v-for="(term, i) in row.terms" :key="i">
          <span v-if="i || term.sign !== '+'">{{ term.sign === '-' ? '−' : term.sign }}</span>
          <template v-if="term.kind === 'dice'">
            <span v-if="term.n > 1">{{ term.n }}×</span>
            <SystemDie :sides="term.sides" :value="'d' + term.sides" :size="30"
              :color="term.color || 'var(--accent-soft)'" :animated="false" :title="term.label || undefined" />
          </template>
          <strong v-else :title="term.label || undefined">{{ !i && term.sign === '+' ? '+' : '' }}{{ term.value }}</strong>
        </template>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { parseDiceExpression } from '@/shared/lib/dice'
import SystemDie from '@/shared/ui/SystemDie.vue'
const props = defineProps({ rows: { type: Array, required: true }, scope: String })
const parsed = computed(() => {
  const groups = new Map()
  for (const { source, expression } of props.rows) {
    if (!groups.has(source)) groups.set(source, [])
    groups.get(source).push(...parseDiceExpression(expression))
  }
  return Array.from(groups, ([source, terms]) => ({ source, terms }))
})
</script>
<style scoped>
.weapon-formula { display: grid; gap: 4px; padding: 8px 10px; border-radius: var(--radius-row); background: var(--surface); }
.weapon-formula-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.weapon-formula-row small { color: var(--text-2); overflow-wrap: anywhere; min-width: 0; }
.weapon-formula-terms { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 3px; font-variant-numeric: tabular-nums; }
</style>
