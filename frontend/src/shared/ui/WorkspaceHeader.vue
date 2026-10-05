<template>
  <header ref="element" class="workspace-header">
    <div class="workspace-header-identity"><slot name="identity" /></div>
    <div class="workspace-header-navigation"><slot name="navigation" /></div>
    <div class="workspace-header-actions"><slot name="actions" /></div>
  </header>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
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
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(142px, 1fr);
  align-items: center;
  gap: 12px;
  flex: none;
  min-height: 64px;
  box-sizing: border-box;
  padding: 4px 14px;
  border-bottom: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--scrim) 45%, transparent);
}
.workspace-header-identity {
  min-width: 0;
  min-height: 54px;
  display: flex;
  align-items: center;
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
  .workspace-header {
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
@media (max-width: 760px) {
  .workspace-header {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-inline: 10px;
  }
  .workspace-header-navigation {
    grid-row: 2;
    grid-column: 1/-1;
    justify-self: center;
  }
}
</style>
