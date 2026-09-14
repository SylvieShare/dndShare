<template>
  <span class="transfer-status" :class="`transfer-status--${status}`">
    <component :is="presentation.icon" :size="15" aria-hidden="true" />{{ presentation.label }}
  </span>
</template>
<script setup>
import { computed } from 'vue'
import { Clock3, CircleCheck, CircleX } from '@lucide/vue'
const props = defineProps({ status: { type: String, default: 'pending' }, purpose: { type: String, default: 'transfer' } })
const presentation = computed(() => ({
  pending: { icon: Clock3, label: 'Ожидает' },
  accepted: { icon: CircleCheck, label: props.purpose === 'use' ? 'Использовано' : 'Приняли' },
  rejected: { icon: CircleX, label: props.purpose === 'use' ? 'Доза возвращена' : 'Отказали' },
})[props.status] || { icon: Clock3, label: 'Ожидает' })
</script>
<style scoped>
.transfer-status { display: inline-flex; align-items: center; gap: 6px; flex: none; width: fit-content; padding: 5px 9px; border-radius: var(--r-sm); color: var(--warning); background: color-mix(in srgb, currentColor 12%, transparent); font-size: 12px; font-weight: 750; line-height: 1.3; }
.transfer-status--accepted { color: var(--success); }
.transfer-status--rejected { color: var(--danger); }
</style>
