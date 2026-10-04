<template>
  <span class="rich-calculation" :aria-label="accessibleLabel">
    <span v-if="label" class="rich-calculation-label">{{ label }}</span>
    <span class="rich-calculation-equation">
      <span>{{ formulaLabel }}</span>
      <template v-if="result.value != null">
        <span aria-hidden="true">=</span>
        <strong class="rich-calculation-result" :title="substitution">{{ result.value }}</strong>
      </template>
    </span>
    <small v-if="result.error" class="rich-calculation-error">{{ result.error }}</small>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { calculateRichFormula, richFormulaLabel } from '@/shared/lib/richCalculation'

const props = defineProps({ node: { type: Object, required: true }, context: { type: Object, default: null } })
const formula = computed(() => props.node.payload?.formula || '')
const label = computed(() => props.node.payload?.label || '')
const result = computed(() => calculateRichFormula(formula.value, props.context || {}))
const formulaLabel = computed(() => richFormulaLabel(formula.value, props.context || {}))
const substitution = computed(() => `${richFormulaLabel(formula.value, props.context || {}, true)} = ${result.value.value}`)
const accessibleLabel = computed(() => [label.value, formulaLabel.value, result.value.value].filter(value => value != null && value !== '').join(': '))
</script>

<style scoped>
.rich-calculation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 2px solid var(--accent-soft);
  border-radius: var(--r-sm);
  background: var(--surface-raised);
  color: var(--text-2);
  font: 12px/1.45 var(--font-ui);
  text-align: left;
}
.rich-calculation-label { color: var(--text-muted); font-size: 11px; }
.rich-calculation-equation { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.rich-calculation-result { color: var(--accent-soft); font-size: 18px; font-variant-numeric: tabular-nums; }
.rich-calculation-error { color: var(--danger); }
</style>
