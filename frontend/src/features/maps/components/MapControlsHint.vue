<template>
  <div ref="element" class="map-controls-hint" :data-expanded="!collapsed">
    <BaseTile class="map-controls-hint-panel">
      <ActionButton
        v-if="collapsed"
        ref="button"
        variant="quiet"
        :aria-expanded="false"
        aria-label="Управление картой"
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
        aria-label="Команды управления картой"
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
defineProps({ lines: { type: Array, required: true } });
const collapsed = ref(false),
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
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.map-controls-hint-panel > :first-child:not(ul) {
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
  white-space: nowrap;
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
