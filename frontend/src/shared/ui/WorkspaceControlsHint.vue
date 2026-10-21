<template>
  <div ref="element" class="workspace-controls-hint" :data-expanded="!collapsed" @pointerdown.stop @wheel.stop @dblclick.stop>
    <BaseTile class="workspace-controls-hint-panel">
      <div v-if="$slots.actions" class="workspace-controls-hint-actions"><slot name="actions" /></div>
      <ActionButton
        v-if="collapsed"
        ref="button"
        variant="quiet"
        :aria-expanded="false"
        :aria-label="label"
        @click="toggle"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <template #icon><Keyboard :size="15" /></template>Управление<ChevronDown
          :size="14"
        />
      </ActionButton>
      <ul
        v-else
        ref="commands"
        tabindex="0"
        :aria-label="commandsLabel"
        aria-description="Нажмите Enter или пробел, чтобы свернуть подсказки."
        title="Нажмите, чтобы свернуть"
        @click="toggle"
        @keydown.enter.stop.prevent="toggle"
        @keydown.space.stop.prevent="toggle"
      >
        <li v-for="(line, index) in lines" :key="index">{{ line }}</li>
      </ul>
    </BaseTile>
  </div>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref } from "vue";
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import { ChevronDown, Keyboard } from "@lucide/vue";
const props = defineProps({ lines: { type: Array, required: true }, label: { type: String, default: "Управление" }, commandsLabel: { type: String, default: "Команды управления" }, initiallyCollapsed: Boolean });
const collapsed = ref(props.initiallyCollapsed),
  element = ref(null),
  commands = ref(null),
  button = ref(null);
let animation,
  fade,
  epoch = 0;
async function toggle(event) {
  const node = element.value,
    before = node.getBoundingClientRect(),
    id = ++epoch;
  animation?.cancel();
  fade?.cancel();
  collapsed.value = !collapsed.value;
  await nextTick();
  if (id !== epoch || !element.value) return;
  const after = node.getBoundingClientRect();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    animation = node.animate(
      [
        { width: `${before.width}px`, height: `${before.height}px` },
        { width: `${after.width}px`, height: `${after.height}px` },
      ],
      { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    fade = node.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
  }
  if (event?.type === "keydown" || event?.detail === 0)
    (collapsed.value ? button.value?.$el : commands.value)?.focus({
      preventScroll: true,
    });
}
onBeforeUnmount(() => {
  epoch++;
  animation?.cancel();
  fade?.cancel();
});
</script>
<style scoped>
.workspace-controls-hint {
  position: absolute;
  bottom: var(--workspace-hint-bottom, 16px);
  left: calc(var(--workspace-hint-inset, 0px) + 16px);
  max-width: min(
    420px,
    max(0px, calc(100% - var(--workspace-hint-inset, 0px) - 270px))
  );
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0.64;
  transition: opacity 0.16s ease;
}
.workspace-controls-hint:hover,
.workspace-controls-hint:focus-within {
  opacity: 1;
}
.workspace-controls-hint-panel {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.workspace-controls-hint-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; color: var(--text-2); font-size: 11px; }
.workspace-controls-hint-panel > :first-child:not(ul) {
  flex-shrink: 0;
}
ul {
  min-height: 0;
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 9px 10px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
}
ul:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
li {
  white-space: normal;
}
@media (max-width: 760px) {
  .workspace-controls-hint {
    bottom: var(--workspace-hint-mobile-bottom, 76px);
    max-height: calc(100% - 92px);
    max-width: max(0px, calc(100% - var(--workspace-hint-inset, 0px) - 32px));
  }
  ul {
    font-size: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-controls-hint {
    transition: none;
  }
}
</style>
