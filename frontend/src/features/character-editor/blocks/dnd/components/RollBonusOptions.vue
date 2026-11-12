<template>
  <template v-if="rules.length">
    <ToggleSwitch v-for="rule in rules" :key="rule.key" class="roll-bonus-option"
      block surface="raised" track-placement="end" :aria-label="rule.source_label || 'Бонус к броску'"
      :aria-description="'Бонус к броску: ' + rule.formula.replace(/\{[^}]*\}/g, '').replaceAll('d', 'к')"
      :model-value="!modelValue.includes(rule.key)" @update:model-value="value => toggle(rule.key, value)">
      <span class="roll-bonus-option__content">
        <ItemIcon v-if="rule.source_item || rule.source_status?.item" :item="rule.source_item || rule.source_status.item" :size="24" :fallback-to-type="false" placeholder />
        <span class="roll-bonus-option__name">{{ rule.source_label || 'Бонус к броску' }}</span>
        <DamageFormulaPreview class="roll-bonus-option__formula" unframed :size="24" :expression="rule.formula" label="" aria-hidden="true" />
      </span>
    </ToggleSwitch>
  </template>
</template>
<script setup>
import { computed, inject } from 'vue'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ scope: String, characterContext: Object, rollContext: Object, modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const ctx = inject('charCtx', {})
const rules = computed(() => (props.characterContext || ctx).characterDerivedEffects?.rollBonusOptions?.({ kind: props.scope, ...props.rollContext }) || [])
function toggle(key, enabled) {
  emit('update:modelValue', enabled ? props.modelValue.filter(value => value !== key) : [...props.modelValue, key])
}
</script>
<style scoped>
.roll-bonus-option__content {display:flex;align-items:center;gap:var(--spacing-small);min-width:0;width:100%}
.roll-bonus-option__name {flex:1;min-width:0;overflow-wrap:anywhere}
.roll-bonus-option__formula {flex:none}
</style>
