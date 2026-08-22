<template>
  <div class="rm-control">
    <div class="rm-options" role="group" :aria-label="label">
      <button v-for="option in options" :key="option.value" type="button" :class="{ active: modelValue === option.value }" @click="$emit('update:modelValue', option.value)">{{ option.label }}</button>
    </div>
    <small v-if="modelValue === 'auto' && autoMode !== 'normal'">Автоматически: {{ autoMode === 'advantage' ? 'преимущество' : 'помеха' }}{{ source ? ` · ${source}` : '' }}</small>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'auto' },
  autoMode: { type: String, default: 'normal' },
  source: { type: String, default: '' },
  label: { type: String, default: 'Режим броска' },
})
defineEmits(['update:modelValue'])
const options = [
  { value: 'auto', label: 'Авто' },
  { value: 'normal', label: 'Обычно' },
  { value: 'advantage', label: 'Преимущество' },
  { value: 'disadvantage', label: 'Помеха' },
]
</script>

<style scoped>
.rm-control { display: flex; flex-direction: column; gap: 5px; }
.rm-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.rm-options button { min-width: 0; border: 1px solid var(--border); border-radius: 7px; padding: 6px 4px; background: var(--surface-raised); color: var(--text-muted); font: inherit; font-size: 10px; cursor: pointer; }
.rm-options button.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); color: var(--accent); font-weight: 700; }
.rm-control small { color: var(--text-muted); font-size: 10px; line-height: 1.4; }
</style>
