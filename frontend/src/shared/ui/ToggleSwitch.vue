<template>
  <button class="toggle-btn" :class="{ active: modelValue }" type="button" @click="$emit('update:modelValue', !modelValue)">
    <span class="toggle-track" :class="{ on: modelValue }">
      <span class="toggle-thumb"></span>
    </span>
    <span class="toggle-text">{{ label }}</span>
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, required: true },
  label: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.toggle-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.toggle-text {
  color: var(--text-muted);
  font-size: 13px;
  font-family: inherit;
  transition: color 0.2s ease;
}

.toggle-btn.active .toggle-text {
  color: var(--text-2);
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  background-color: var(--bg);
  border-radius: 11px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.toggle-track.on {
  background-color: var(--accent);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background-color: var(--text-muted);
  border-radius: 50%;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.toggle-track.on .toggle-thumb {
  transform: translateX(16px);
  background-color: var(--text-on-accent);
}
</style>
