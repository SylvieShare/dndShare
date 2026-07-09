<template>
  <button class="add-btn" :class="{ 'add-btn--block': block }" type="button" @click="$emit('click', $event)">
    <span class="add-btn-plus" aria-hidden="true">+</span>
    <span class="add-btn-text"><slot>Добавить</slot></span>
  </button>
</template>

<script setup>
defineProps({
  block: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<style scoped>
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  padding: 7px 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.add-btn:hover {
  border-color: var(--accent);
  color: var(--color-attack);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.add-btn--block {
  width: 100%;
  justify-content: flex-start;
}

.add-btn-plus {
  font-size: 15px;
  line-height: 1;
}
</style>
