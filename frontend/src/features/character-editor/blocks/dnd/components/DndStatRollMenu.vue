<template>
  <BasePopover
    :open="true"
    :anchor="anchor"
    :z-index="4100"
    transition-preset="action-menu"
    role="menu"
    :aria-label="title"
    @update:open="!$event && emit('close')"
  >
    <div class="stat-roll-controls">
      <div class="stat-roll-mode" role="group" aria-label="Режим броска">
        <ToggleSwitch v-model="disadvantage" label="Помеха" />
        <span class="stat-roll-divider" role="separator" aria-orientation="vertical" />
        <ToggleSwitch v-model="advantage" label="Преимущество" />
      </div>
      <RowActionItem action="feature-damage" @click="emit('roll', rollMode)">Бросить</RowActionItem>
    </div>
  </BasePopover>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BasePopover, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

const props = defineProps({
  anchor: { type: Object, required: true },
  title: { type: String, required: true },
  mode: { type: String, default: 'normal' },
  cancelled: Boolean,
})
const emit = defineEmits(['close', 'roll'])
// A fresh menu snapshots the resolved sheet settings for this roll only.
const advantage = ref(props.cancelled || props.mode === 'advantage')
const disadvantage = ref(props.cancelled || props.mode === 'disadvantage')
const rollMode = computed(() => advantage.value === disadvantage.value
  ? 'normal' : advantage.value ? 'advantage' : 'disadvantage')
</script>

<style scoped>
.stat-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
.stat-roll-mode { display: grid; grid-template-columns: auto 1px auto; align-items: center; justify-content: space-between; gap: 8px; }
.stat-roll-divider { width: 1px; height: 22px; background: var(--border); }
</style>
