<template>
  <div class="workspace-canvas-controls" role="group" aria-label="Масштаб карты" @pointerdown.stop>
    <ActionButton variant="secondary" icon-only :title="zoomOutLabel" :aria-label="zoomOutLabel" @click="emit('zoom', .8)"><Minus :size="16" /></ActionButton>
    <ActionButton variant="secondary" icon-only :title="fitLabel" :aria-label="fitLabel" @click="emit('fit')"><Scan :size="16" /></ActionButton>
    <ActionButton variant="secondary" icon-only :title="zoomInLabel" :aria-label="zoomInLabel" @click="emit('zoom', 1.25)"><Plus :size="16" /></ActionButton>
    <slot />
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Minus, Plus, Scan } from '@lucide/vue'
defineProps({ zoomOutLabel: { type: String, default: 'Уменьшить' }, fitLabel: { type: String, default: 'Показать всю карту' }, zoomInLabel: { type: String, default: 'Увеличить' } })
const emit = defineEmits(['zoom', 'fit'])
</script>
<style scoped>
.workspace-canvas-controls { display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border-strong); }
</style>
