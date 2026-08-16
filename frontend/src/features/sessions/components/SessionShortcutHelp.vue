<template>
  <button
    type="button"
    class="session-shortcut-help"
    :class="{ 'session-shortcut-help--active': active }"
    :aria-pressed="active"
    aria-keyshortcuts="?"
    :title="active ? 'Скрыть подсказки горячих клавиш' : 'Показать подсказки горячих клавиш'"
    @click="$emit('toggle')"
  >
    <kbd>?</kbd>
    <span>{{ active ? 'Скрыть подсказки' : 'Горячие клавиши' }}</span>
  </button>
</template>

<script setup>
defineProps({ active: { type: Boolean, default: false } })
defineEmits(['toggle'])
</script>

<style scoped>
.session-shortcut-help {
  position: absolute;
  z-index: 19;
  bottom: 12px;
  left: 14px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 2px;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
  font: 650 10px/1.2 var(--font-ui);
  cursor: pointer;
  text-shadow: 0 1px 8px var(--app-canvas-bg), 0 0 18px var(--app-canvas-bg);
  transition: color .15s, opacity .15s;
}
.session-shortcut-help:hover,
.session-shortcut-help--active { color: var(--text-1); }
.session-shortcut-help kbd {
  width: 17px;
  height: 17px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--text-muted) 42%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--app-canvas-bg) 72%, transparent);
  color: var(--text-2);
  font: 750 10px/1 var(--font-ui);
}
.session-shortcut-help--active kbd { border-color: color-mix(in srgb, var(--accent) 58%, transparent); color: var(--accent-soft); }
@media (max-width: 760px), (pointer: coarse) {
  .session-shortcut-help { display: none; }
}
</style>
