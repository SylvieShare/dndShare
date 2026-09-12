<template>
    <div class="d20-roll-controls">
      <div class="d20-roll-mode" role="group" aria-label="Режим броска">
        <ToggleSwitch v-model="disadvantage" label="Помеха" />
        <span class="d20-roll-divider" role="separator" aria-orientation="vertical" />
        <ToggleSwitch v-model="advantage" label="Преимущество" />
      </div>
      <RowActionItem :action="action" :disabled="disabled" @click="!disabled && emit('roll', rollMode)">{{ rollLabel }}</RowActionItem>
    </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({
  mode: { type: String, default: 'normal' },
  cancelled: Boolean,
  disabled: Boolean,
  action: { type: String, default: 'feature-damage' },
  rollLabel: { type: String, default: 'Бросить' },
})
const emit = defineEmits(['roll'])
// A fresh menu snapshots the resolved sheet settings for this roll only.
const advantage = ref(props.cancelled || props.mode === 'advantage')
const disadvantage = ref(props.cancelled || props.mode === 'disadvantage')
const rollMode = computed(() => advantage.value === disadvantage.value
  ? 'normal' : advantage.value ? 'advantage' : 'disadvantage')
</script>
<style scoped>
.d20-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 0; }
.d20-roll-mode { display: grid; grid-template-columns: auto 1px auto; align-items: center; justify-content: space-between; gap: 8px; }
.d20-roll-divider { width: 1px; height: 22px; background: var(--border); }
</style>
