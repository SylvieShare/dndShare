<template>
  <div v-if="expression" class="damage-preview" aria-label="Итоговая формула урона">
    <small>Итоговый урон</small>
    <div class="damage-preview-formula">
      <template v-for="(group, index) in groups" :key="index">
        <span v-if="index" aria-hidden="true">+</span>
        <DamageDice :parts="group.parts" :modifier="group.modifier" :size="26" :default-color="group.color || 'var(--accent-soft)'" />
      </template>
      <span v-if="!groups.length">0</span>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { parseDiceExpression } from '@/shared/lib/dice'
import DamageDice from './DamageDice.vue'
const props = defineProps({ expression: { type: String, default: '' } })
const groups = computed(() => {
  const result = new Map()
  for (const token of parseDiceExpression(props.expression)) {
    const key = `${token.label || ''}|${token.color || ''}`
    if (!result.has(key)) result.set(key, { parts: [], modifier: 0, color: token.color })
    const group = result.get(key)
    if (token.kind === 'dice') group.parts.push({ count: token.n, diceSides: token.sides, diceLabel: `d${token.sides}`, type: token.label, typeColor: token.color })
    else group.modifier += token.value * (token.sign === '-' ? -1 : 1)
  }
  return [...result.values()].filter(group => group.parts.length || group.modifier)
})
</script>
<style scoped>
.damage-preview { display: grid; gap: 6px; padding-top: 4px; }
.damage-preview > small { color: var(--text-muted); font-size: 11px; }
.damage-preview-formula { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px; color: var(--text-2); }
</style>
