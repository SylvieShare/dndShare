<template>
  <section v-if="rules.length || hasAdditionalOptions" class="roll-additional-options" role="group" aria-label="Дополнительные эффекты">
    <h3 class="roll-additional-options__title">Дополнительные эффекты</h3>
    <div v-if="rules.length || $slots.default" class="dnd-roll-option-strip dnd-roll-option-strip--effects">
      <slot />
      <ChoiceCard v-for="rule in rules" :key="rule.key" class="roll-bonus-option" layout="icon" centered selection-indicator="outline"
        :label="rule.source_label || 'Бонус к броску'" :description="formula(rule)"
        :title="`${rule.source_label || 'Бонус к броску'}: ${formula(rule)}`"
        :model-value="!modelValue.includes(rule.key)" @update:model-value="value => toggle(rule.key, value)">
        <template #icon>
          <ItemIcon v-if="rule.source_item || rule.source_status?.item" :item="rule.source_item || rule.source_status.item" :size="layoutTokens['weapon-roll-option-icon']" :fallback-to-type="false" placeholder />
          <Sparkles v-else aria-hidden="true" />
        </template>
      </ChoiceCard>
    </div>
    <div v-if="$slots.details" class="roll-additional-options__details"><slot name="details" /></div>
  </section>
</template>
<script setup>
import { computed, inject } from 'vue'
import { ChoiceCard } from '@sylvieshare/share-ui'
import { Sparkles } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import './RollOptionTiles.css'
const props = defineProps({ scope: String, characterContext: Object, rollContext: Object, hasAdditionalOptions: Boolean, modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const ctx = inject('charCtx', {})
const rules = computed(() => props.scope ? (props.characterContext || ctx).characterDerivedEffects?.rollBonusOptions?.({ kind: props.scope, ...props.rollContext }) || [] : [])
const formula = rule => rule.formula.replace(/\{[^}]*\}/g, '').replaceAll('d', 'к')
function toggle(key, enabled) {
  emit('update:modelValue', enabled ? props.modelValue.filter(value => value !== key) : [...props.modelValue, key])
}
</script>
<style scoped>
.roll-additional-options {display:grid;gap:var(--spacing-xs);min-width:0}
.roll-additional-options__title {margin:0;color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600}
.roll-additional-options__details {display:grid;gap:var(--spacing-small);min-width:0}
</style>
