<template>
  <div class="d20-roll-controls" :class="{ 'd20-roll-controls--dialog': dialog }">
    <div class="d20-roll-options">
      <RollModePicker v-model="rollMode" :disabled="disabled" />
      <RollBonusOptions v-if="scope" :scope="scope" :character-context="characterContext" :roll-context="rollContext" v-model="excludedBonuses" />
    </div>
    <ActionButton v-if="dialog" :disabled="disabled" @click="!disabled && emit('roll', rollMode, excludedBonuses)">{{ rollLabel }}</ActionButton>
    <RowActionItem v-else :action="action" :size="expression ? 'large' : 'default'" :disabled="disabled" :aria-description="expression ? `Формула броска: ${expression}` : undefined" @click="!disabled && emit('roll', rollMode, excludedBonuses)">
      {{ rollLabel }}
      <template v-if="expression" #suffix>
        <DamageFormulaPreview unframed inline label="" :size="34" :expression="expression" :default-color="color" :title="expression" aria-hidden="true" />
      </template>
    </RowActionItem>
  </div>
</template>
<script setup>
import RollBonusOptions from './RollBonusOptions.vue'
import { computed, inject, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { d20Expression } from '@/shared/lib/pendingDice'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
import RollModePicker from './RollModePicker.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({
  mode: { type: String, default: 'normal' },
  scope: String,
  characterContext: Object,
  rollContext: Object,
  bonus: Number,
  color: String,
  cancelled: Boolean,
  disabled: Boolean,
  dialog: Boolean,
  action: { type: String, default: 'feature-damage' },
  rollLabel: { type: String, default: 'Бросить' },
})
const emit = defineEmits(['roll', 'preview'])
const excludedBonuses = ref([])
// Each opening snapshots the resolved sheet settings for this roll only.
const rollMode = ref(props.cancelled ? 'normal' : props.mode)
const ctx = inject('charCtx', {})
const expression = computed(() => props.bonus == null ? '' : d20Expression(props.bonus, rollMode.value,
  (props.characterContext || ctx).characterDerivedEffects?.rollBonus?.({ kind: props.scope, ...props.rollContext }, excludedBonuses.value)))
watch([rollMode, excludedBonuses], ([mode, excluded]) => emit('preview', { mode, excluded }), { immediate: true, flush: 'sync' })
</script>
<style scoped>
.d20-roll-options { display: flex; flex-direction: column; gap: 10px; padding: 8px; width: var(--layout-roll-mode-menu-width); max-width: min(100%, calc(100vw - 32px)); box-sizing: border-box; }
.d20-roll-controls--dialog {display:grid;gap:var(--spacing-medium);min-width:0}
.d20-roll-controls--dialog .d20-roll-options {width:100%;max-width:none;padding:var(--spacing-xs)}
</style>
