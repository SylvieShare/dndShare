<template>
  <Transition name="map-focus-back">
    <ActionButton
      v-if="entry"
      class="map-focus-back"
      variant="quiet"
      block
      :aria-label="`Назад к ${entry.name}`"
      @click="emit('back')"
    >
      <template #icon
        ><ArrowLeft :size="18" /><component :is="icon" :size="18"
      /></template>
      <span>{{ entry.name }}</span>
    </ActionButton>
  </Transition>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { ArrowLeft, Box, Group, Layers, Lightbulb } from "@lucide/vue";
const props = defineProps({ entry: Object });
const emit = defineEmits(["back"]);
const icon = computed(
  () =>
    ({ area: Group, tile: Layers, group: Layers, light: Lightbulb })[
      props.entry?.kind
    ] || Box,
);
</script>
<style scoped>
.map-focus-back {
  flex: none;
  justify-content: flex-start;
  margin: 6px;
  width: calc(100% - 12px);
  min-width: 0;
}
.map-focus-back span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-focus-back-enter-active,
.map-focus-back-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.map-focus-back-enter-from,
.map-focus-back-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
@media (prefers-reduced-motion: reduce) {
  .map-focus-back-enter-active,
  .map-focus-back-leave-active {
    transition: none;
  }
}
</style>
