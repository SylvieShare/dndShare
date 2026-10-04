<template>
  <AppModalFrame title="Расчёт в описании" :z-index="4600" @close="$emit('close')">
    <div class="calculation-form">
      <FormField label="Подпись" vertical>
        <FormTextInput v-model:value="label" aria-label="Подпись" placeholder="Временные хиты, число целей…" />
      </FormField>
      <FormField label="Формула" hint="Арифметика + − * /, скобки, min, max, floor, ceil. Например max(1, casting_mod)." vertical>
        <FormTextInput ref="formulaInput" v-model:value="formula" aria-label="Формула" mono placeholder="casting_mod" @enter="save" />
      </FormField>
      <div class="calculation-variables" aria-label="Значения для формулы">
        <button v-for="(name, key) in CALCULATION_VARIABLES" :key="key" type="button" @click="appendVariable(key)">{{ name }}</button>
      </div>
      <RichCalculationNode v-if="!result.error" :node="previewNode" />
      <span v-else role="status" class="calculation-error">{{ result.error }}</span>
    </div>
    <template #footer>
      <div class="calculation-actions">
        <button v-if="node" type="button" @click="$emit('remove')">Удалить из текста</button>
        <button type="button" @click="$emit('close')">Отмена</button>
        <button type="button" class="calculation-save" :disabled="Boolean(result.error)" @click="save">{{ node ? 'Сохранить' : 'Вставить' }}</button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { AppModalFrame, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { CALCULATION_VARIABLES, calculateRichFormula, richFormulaLabel } from '@/shared/lib/richCalculation'
import RichCalculationNode from './RichCalculationNode.vue'

const props = defineProps({ node: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'remove'])
const label = ref(props.node?.payload?.label || '')
const formula = ref(props.node?.payload?.formula || '')
const formulaInput = ref(null)
const result = computed(() => calculateRichFormula(formula.value))
const previewNode = computed(() => ({ kind: 'calculation', payload: { formula: formula.value.trim(), label: label.value.trim() } }))
function appendVariable(key) {
  formula.value += key
  formulaInput.value?.focus?.()
}
function save() {
  if (result.value.error) return
  const node = previewNode.value
  emit('save', { ...node, label: [node.payload.label, richFormulaLabel(node.payload.formula)].filter(Boolean).join(': ') })
}
onMounted(() => nextTick(() => formulaInput.value?.focus?.()))
</script>

<style scoped>
.calculation-form { display: flex; flex-direction: column; gap: 14px; }
.calculation-variables { display: flex; flex-wrap: wrap; gap: 5px; }
.calculation-variables button, .calculation-actions button { padding: 6px 9px; border: 0; border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-2); font: 12px var(--font-ui); cursor: pointer; }
.calculation-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.calculation-actions .calculation-save { background: var(--accent); color: var(--text-on-accent); }
.calculation-save:disabled { opacity: .45; cursor: default; }
.calculation-error { color: var(--danger); font-size: 12px; }
</style>
