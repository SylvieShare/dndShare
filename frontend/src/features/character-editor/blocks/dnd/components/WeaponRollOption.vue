<template>
  <div :class="{ 'damage-dependent-option': option.nested }">
    <FormField :label="option.label" :title="option.hint">
      <span v-if="option.damageParts.length" class="damage-option-formula" :aria-label="`${option.formulaVerb} ${option.formula}`" role="img">
        <span aria-hidden="true">{{ option.formulaPrefix }}</span>
        <DamageDice :parts="option.damageParts" :size="26" :default-color="option.disabled ? 'var(--text-muted)' : 'var(--accent-soft)'" aria-hidden="true" />
      </span>
      <ToggleSwitch :model-value="option.checked" :disabled="option.disabled" :aria-label="option.label" @update:model-value="value => $emit('select', option.key, value)" />
    </FormField>
    <small v-if="option.condition" class="damage-option-condition">{{ option.condition }}</small>
  </div>
</template>
<script setup>
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import DamageDice from './DamageDice.vue'
defineProps({ option: { type: Object, required: true } })
defineEmits(['select'])
</script>
<style scoped>
.damage-dependent-option { margin-left: 8px; padding-left: 10px; border-left: 2px solid var(--border); }
.damage-option-condition { display: block; max-width: 300px; color: var(--text-muted); font-size: 11px; line-height: 1.4; margin-top: 4px; }
.damage-option-formula { display: inline-flex; align-items: center; gap: 3px; flex: none; white-space: nowrap; color: var(--text-muted); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
