<template>
  <div class="filter-heading" @keydown.stop="onKeydown">
    <component :is="headingTag" class="filter-heading-title">{{
      title
    }}</component>
    <ActionButton
      ref="trigger"
      variant="secondary"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <template #icon><SlidersHorizontal :size="16" /></template>
      {{ activeCount ? `Фильтры · ${activeCount}` : "Фильтры" }}
    </ActionButton>
    <BasePopover
      v-model:open="open"
      :id="panelId"
      :anchor="trigger?.$el"
      :min-width="240"
      :z-index="3500"
      placement="bottom-end"
      role="dialog"
      :aria-label="label"
    >
      <div class="filter-heading-options" @keydown.stop="onKeydown">
        <slot />
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { ref, useId } from "vue";
import { ActionButton, BasePopover } from "@sylvieshare/share-ui";
import { SlidersHorizontal } from "@lucide/vue";
defineProps({
  title: String,
  label: { type: String, default: "Параметры фильтра" },
  headingTag: { type: String, default: "h3" },
  activeCount: { type: Number, default: 0 },
});
const open = ref(false),
  trigger = ref(null),
  panelId = `filters-${useId()}`;
function onKeydown(event) {
  if (event.key === "Escape" && !event.defaultPrevented) {
    event.preventDefault();
    open.value = false;
    trigger.value?.$el.focus();
  }
}
</script>
<style scoped>
.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filter-heading-title {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.3;
  font-weight: 700;
}
.filter-heading-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 6px;
}
</style>
