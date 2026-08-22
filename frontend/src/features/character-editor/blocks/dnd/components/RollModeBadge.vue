<template>
  <span v-if="mode !== 'normal'" class="roll-badge" :class="`roll-badge--${mode}`" :title="title">
    {{ mode === 'advantage' ? 'ПРЕИМ.' : 'ПОМ.' }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'normal' },
  source: { type: String, default: '' },
})
const title = computed(() => [props.mode === 'advantage' ? 'Преимущество' : 'Помеха', props.source].filter(Boolean).join(' · '))
</script>

<style scoped>
.roll-badge { display: inline-flex; align-items: center; flex-shrink: 0; border: 1px solid currentColor; border-radius: 999px; padding: 1px 5px; font-size: 8px; font-weight: 800; letter-spacing: .04em; line-height: 1.25; }
.roll-badge--advantage { color: var(--success); background: color-mix(in srgb, currentColor 9%, transparent); }
.roll-badge--disadvantage { color: var(--danger); background: color-mix(in srgb, currentColor 9%, transparent); }
</style>
