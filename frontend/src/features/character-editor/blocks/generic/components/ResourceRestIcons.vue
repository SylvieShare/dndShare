<template>
  <span v-if="hasRest" class="rri" aria-label="Восстановление ресурса">
    <span
      v-if="resource.short_rest || resource.short_rest_recovery"
      class="rri-icon"
      :title="resource.short_rest ? 'Восстанавливается на коротком отдыхе' : `Восстанавливает ${resource.short_rest_recovery} на коротком отдыхе`"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    </span>
    <span v-if="resource.long_rest" class="rri-icon" title="Восстанавливается на длинном отдыхе">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  resource: { type: Object, required: true },
})

const hasRest = computed(() => !!(
  props.resource.short_rest
  || props.resource.short_rest_recovery
  || props.resource.long_rest
))
</script>

<style scoped>
.rri { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted); }
.rri-icon { display: inline-flex; flex: 0 0 auto; align-items: center; }
</style>
