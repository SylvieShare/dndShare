<template>
  <div class="map-controls-hint">
    <BaseTile class="map-controls-hint-panel">
      <ActionButton
        variant="quiet"
        :aria-expanded="!collapsed"
        aria-label="Управление картой"
        @click="collapsed = !collapsed"
      >
        <template #icon><Keyboard :size="15" /></template>Управление
        <ChevronDown :size="14" :class="{ 'map-hint-expanded': !collapsed }" />
      </ActionButton>
      <ul
        v-if="!collapsed"
        aria-label="Команды управления картой"
        @click="collapsed = true"
      >
        <li v-for="(line, index) in lines" :key="index">{{ line }}</li>
      </ul>
    </BaseTile>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import { ChevronDown, Keyboard } from "@lucide/vue";
defineProps({ lines: { type: Array, required: true } });
const collapsed = ref(false);
</script>
<style scoped>
.map-controls-hint {
  position: absolute;
  bottom: 16px;
  left: 16px;
  max-width: min(420px, calc(100% - 270px));
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0.64;
  transition: opacity 0.16s ease;
}
.map-controls-hint:hover,
.map-controls-hint:focus-within {
  opacity: 1;
}
.map-controls-hint-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-controls-hint-panel > :first-child {
  flex-shrink: 0;
}
ul {
  min-height: 0;
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 0 10px 9px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
}
li {
  white-space: nowrap;
}
.map-hint-expanded {
  transform: rotate(180deg);
}
@media (max-width: 760px) {
  .map-controls-hint {
    bottom: 76px;
    max-height: calc(100% - 92px);
    max-width: calc(100% - 32px);
  }
  ul {
    font-size: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .map-controls-hint {
    transition: none;
  }
}
</style>
