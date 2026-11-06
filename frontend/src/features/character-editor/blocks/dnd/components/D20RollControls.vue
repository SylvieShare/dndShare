<template>
  <div class="d20-roll-controls">
    <div class="d20-roll-options">
      <RollModePicker v-model="rollMode" :disabled="disabled" />
      <RollBonusOptions v-if="scope" :scope="scope" :character-context="characterContext" :roll-context="rollContext" v-model="excludedBonuses" />
    </div>
    <RowActionItem :action="action" :disabled="disabled" @click="!disabled && emit('roll', rollMode, excludedBonuses)">{{ rollLabel }}</RowActionItem>
  </div>
</template>
<script setup>
import RollBonusOptions from './RollBonusOptions.vue'
import { ref } from 'vue'
import RollModePicker from './RollModePicker.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({
  mode: { type: String, default: 'normal' },
  scope: String,
  characterContext: Object,
  rollContext: Object,
  cancelled: Boolean,
  disabled: Boolean,
  action: { type: String, default: 'feature-damage' },
  rollLabel: { type: String, default: 'Бросить' },
})
const emit = defineEmits(['roll'])
const excludedBonuses = ref([])
// A fresh menu snapshots the resolved sheet settings for this roll only.
const rollMode = ref(props.cancelled ? 'normal' : props.mode)
</script>
<style scoped>
.d20-roll-options { display: flex; flex-direction: column; gap: 10px; padding: 8px; width: var(--layout-roll-mode-menu-width); max-width: min(100%, calc(100vw - 32px)); box-sizing: border-box; }
</style>
