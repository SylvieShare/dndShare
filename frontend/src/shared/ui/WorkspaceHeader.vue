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
  observer = new ResizeObserver(() => {
    if (!element.value) return
    const main = element.value.querySelector('.workspace-header-inner');
    element.value.style.setProperty('--workspace-main-height', `${main.getBoundingClientRect().height}px`);
    emit("resize", element.value.getBoundingClientRect().height);
  });
  observer.observe(element.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<style scoped>
.workspace-header {
  position: relative;
  z-index: 20;
  flex: none;
  --workspace-main-height: var(--layout-header);
  isolation: isolate;
  background: transparent;
}
.workspace-header::before {
  content: '';
  position: absolute;
  inset: 0 0 calc(-1 * (var(--chrome-fade-tail) + var(--workspace-extra-fade, 0px)));
  z-index: -1;
  pointer-events: none;
  background: color-mix(in srgb, var(--bg) calc(var(--chrome-tint) * 100%), transparent);
  backdrop-filter: blur(var(--chrome-blur));
  -webkit-backdrop-filter: blur(var(--chrome-blur));
  mask-mode: alpha;
  mask-image: linear-gradient(to bottom, var(--text-on-accent) var(--workspace-main-height), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, var(--text-on-accent) var(--workspace-main-height), transparent 100%);
}
.workspace-header-inner {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(142px, 1fr);
  align-items: center;
  gap: var(--spacing-medium);
  min-height: var(--layout-header);
  box-sizing: border-box;
  width: 100%;
  margin-inline: auto;
  padding: var(--spacing-xs) 14px;
  transition: max-width var(--motion-navigation);
}
.workspace-header-inner--page { padding-inline: var(--spacing-page); }
.workspace-subheader { padding: 4px 8px; }
.workspace-subheader-inner { --surface: var(--subheader); display: flex; justify-content: center; box-sizing: border-box; width: 100%; min-width: 0; margin-inline: auto; padding: var(--spacing-xs); border-radius: var(--radius-compact-navigation); background: var(--subheader); overflow-x: auto; }
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
  --surface: var(--subheader);
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
  .workspace-subheader { border: 0; background: transparent; padding: var(--spacing-xs) var(--layout-compact-header-inset); }
  .workspace-subheader-inner, .workspace-header-navigation {
    background: var(--subheader); border: 0; border-radius: var(--radius-compact-navigation);
  }
  .workspace-header-navigation { padding: var(--spacing-xs); }
}
@media (prefers-reduced-motion: reduce) { .workspace-header-inner { transition: none; } }
</style>
