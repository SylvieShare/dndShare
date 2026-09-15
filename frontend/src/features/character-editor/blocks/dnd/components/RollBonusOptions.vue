<template>
  <template v-if="rules.length">
    <RowActionSeparator />
    <div v-for="rule in rules" :key="rule.key" class="roll-bonus-option">
      <ToggleSwitch :label="rule.source_label || 'Бонус к броску'" :model-value="!modelValue.includes(rule.key)"
        @update:model-value="value => toggle(rule.key, value)" />
      <DamageFormulaPreview unframed :expression="rule.formula" label="" aria-label="Бонус к броску" />
    </div>
  </template>
</template>
<script setup>
import { computed, inject } from 'vue'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ scope: String, modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const ctx = inject('charCtx', {})
const rules = computed(() => ctx.characterDerivedEffects?.rollBonusOptions?.({ kind: props.scope }) || [])
function toggle(key, enabled) {
  emit('update:modelValue', enabled ? props.modelValue.filter(value => value !== key) : [...props.modelValue, key])
}
</script>
<style scoped>
.roll-bonus-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.roll-bonus-option :deep(.system-die) { width: 23px; height: 23px; }
</style>
