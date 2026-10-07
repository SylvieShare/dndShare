<template>
  <div class="map-canvas-controls">
    <ActionButton
      variant="secondary"
      title="Уменьшить"
      aria-label="Уменьшить"
      @click="emit('zoom', 0.8)"
      ><Minus :size="16"
    /></ActionButton>
    <ActionButton
      variant="secondary"
      title="Показать всю карту"
      @click="emit('fit')"
      aria-label="Показать всю карту"
      ><Scan :size="16"
    /></ActionButton>
    <ActionButton
      variant="secondary"
      title="Увеличить"
      aria-label="Увеличить"
      @click="emit('zoom', 1.25)"
      ><Plus :size="16"
    /></ActionButton>
    <ActionButton
      variant="secondary"
      :title="topView ? 'Изометрический вид' : 'Вид сверху'"
      @click="emit('toggle-view')"
      ><Box :size="16"
    /></ActionButton>
  </div>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { Box, Minus, Plus, Scan } from "@lucide/vue";
defineProps({ topView: Boolean });
const emit = defineEmits(["zoom", "fit", "toggle-view"]);
</script>
<style scoped>
.map-canvas-controls {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
}
</style>
