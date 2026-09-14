<template>
  <span class="event-entity-label">
    <SessionEventIcon :event="entry.events[0]" :item="item" />
    <button v-if="entry.entity.itemId" type="button" class="event-item-link" @click="emit('view', entry.entity)">{{ name }}</button>
    <strong v-else>{{ name }}</strong>
  </span>
</template>
<script setup>
import SessionEventIcon from './SessionEventIcon.vue'
defineProps({ entry: Object, item: Object, name: String })
const emit = defineEmits(['view'])
</script>
<style scoped>
.event-entity-label { display: inline-flex; gap: 12px; align-items: center; min-width: 0; max-width: 100%; color: var(--text-1); font-size: 14px; overflow-wrap: anywhere; }
.event-item-link { padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; font-weight: 650; text-align: left; text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 4px; cursor: pointer; overflow-wrap: anywhere; min-width: 0; }
.event-item-link:hover { color: var(--accent-soft); text-decoration-color: currentColor; }
.event-item-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
</style>
