<template>
  <RowActionSeparator v-if="rows.length" />
  <div v-for="row in rows" :key="`${row.useKey}:${row.step.key}`" class="weapon-use-menu-step">
    <DamageFormulaPreview :expression="row.expression" label="" unframed />
    <RowActionItem action="damage" :disabled="row.disabled" :title="row.error || undefined" @click="!row.disabled && $emit('roll', { weaponUseKey: row.useKey, stepKey: row.step.key })">{{ row.step.title }}</RowActionItem>
  </div>
</template>
<script setup>
import { computed, inject, unref } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { weaponUseState } from '@/features/character-editor/lib/weaponUses'
import { weaponDamageActionExpression } from '../lib/weaponDamageAction'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ weaponUid: String, uses: { type: Array, default: () => [] } })
defineEmits(['roll'])
const charCtx = inject('charCtx', {}), suggest = useSuggestStore()
const rows = computed(() => {
  const event = weaponUseState(unref(charCtx.values) || {}, props.weaponUid)
  const uses = event?.status === 'active' ? [event] : props.uses
  return uses.flatMap(use => use.steps.filter(step => step.kind === 'damage').map(step => {
    const type = suggest.items(12).find(row => Number(row.id) === Number(step.damage_type))
    return { useKey: use.key, step,
      expression: step.expression || weaponDamageActionExpression({ baseExpression: '', action: { ...step, damage_type_label: type?.value, damage_type_color: type?.color } }),
      disabled: !charCtx.ownerMode || !!use.disabled || (step.status && step.status !== 'pending'), error: use.error,
    }
  }))
})
</script>
<style scoped>
.weapon-use-menu-step { display: grid; gap: 8px; }
</style>
