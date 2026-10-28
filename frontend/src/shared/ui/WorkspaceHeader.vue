<template>
  <header ref="element" class="workspace-header" :class="{ 'workspace-header--plain': !$slots.navigation || splitNavigation }">
    <div class="workspace-header-inner" :class="{ 'workspace-header-inner--page': page }" :style="{ maxWidth: contentWidth || (page ? 'var(--layout-content-max)' : undefined) }">
    <div class="workspace-header-identity"><slot name="identity" /></div>
    <div v-if="$slots.navigation && !splitNavigation" class="workspace-header-navigation"><slot name="navigation" /></div>
    <div class="workspace-header-actions"><slot name="actions" /></div>
    </div>
    <div v-if="$slots.navigation && splitNavigation" class="workspace-subheader">
      <div class="workspace-subheader-inner" :style="{ maxWidth: contentWidth || (page ? 'var(--layout-content-max)' : undefined) }"><slot name="navigation" /></div>
    </div>
  </header>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
defineProps({ page: Boolean, contentWidth: String, splitNavigation: Boolean });
const element = ref(null),
  emit = defineEmits(["resize"]);
let observer;
onMounted(() => {
  observer = new ResizeObserver(() =>
    emit("resize", element.value.getBoundingClientRect().height),
  );
  observer.observe(element.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<style scoped>
.workspace-header {
  position: relative;
  z-index: 20;
  flex: none;
  border-bottom: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--scrim) 45%, transparent);
}
.workspace-header-inner {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(142px, 1fr);
  align-items: center;
  gap: var(--spacing-medium);
  min-height: calc(var(--layout-header) - var(--layout-border));
  box-sizing: border-box;
  width: 100%;
  margin-inline: auto;
  padding: var(--spacing-xs) 14px;
  transition: max-width var(--motion-navigation);
}
.workspace-header-inner--page { padding-inline: var(--spacing-page); }
.workspace-subheader { border-top: 1px solid var(--border); background: var(--bg); }
.workspace-subheader-inner { display: flex; justify-content: center; box-sizing: border-box; width: 100%; min-width: 0; margin-inline: auto; padding: var(--spacing-xs) 14px; overflow-x: auto; }
.workspace-header-identity {
  min-width: 0;
  min-height: calc(var(--layout-header) - 2 * var(--spacing-xs) - var(--layout-border));
  display: flex;
  align-items: center;
  gap: var(--workspace-header-identity-gap, 0px);
}
.workspace-header--plain .workspace-header-inner {
  grid-template-columns: minmax(0, 1fr) auto;
}
.workspace-header-navigation {
  min-width: 0;
  justify-self: center;
}
.workspace-header-actions {
  min-width: 0;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
}
@container (max-width:1100px) {
  .workspace-header-inner {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 14px;
  }
  .workspace-header-navigation {
    grid-row: 2;
    grid-column: 1/-1;
    max-width: 100%;
    overflow-x: auto;
    justify-self: center;
  }
}
@media (--ui-compact) {
  .workspace-header-inner {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-inline: 10px;
  }
  .workspace-header-navigation {
    grid-row: 2;
    grid-column: 1/-1;
    justify-self: center;
  }
}
@media (--ui-compact) { .workspace-header-inner--page { padding-inline: var(--spacing-large); } }
@media (--ui-phone) { .workspace-header-inner--page { padding-inline: var(--spacing-small); } }
@media (--ui-compact) {
  .workspace-header { background: transparent; border: 0; box-shadow: none; }
  .workspace-header-inner { min-height: var(--layout-header); }
  .workspace-subheader { border: 0; background: transparent; padding: 0 var(--layout-compact-header-inset) var(--layout-compact-header-inset); }
  .workspace-subheader-inner, .workspace-header-navigation {
    background: var(--surface); border: 0; border-radius: var(--radius-compact-navigation);
  }
  .workspace-header-navigation { padding: var(--spacing-xs); }
}
@media (prefers-reduced-motion: reduce) { .workspace-header-inner { transition: none; } }
</style>
