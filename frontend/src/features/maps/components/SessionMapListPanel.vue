<template>
  <section class="session-map-list" aria-label="Карты сессии">
    <AddButton block label="Добавить карту" :disabled="busy" @click="emit('add')" />
    <ul v-if="maps.length">
      <li v-for="map in maps" :key="map.id">
        <ActionButton class="session-map-list__select" :variant="map.id === selected ? 'primary' : 'secondary'"
          :aria-pressed="map.id === selected" @click="emit('select', map.id)">
          <template #icon><component :is="map.document.kind === 'image' ? Image : Map" :size="19" aria-hidden="true" /></template>
          <span class="session-map-list__label">
            <strong>{{ map.name }}</strong>
            <small v-if="map.id === onAir"><MonitorUp :size="14" aria-hidden="true" /> В эфире</small>
          </span>
        </ActionButton>
        <ActionButton variant="quiet" icon-only :disabled="busy" :aria-label="`Переименовать карту «${map.name}»`" @click="emit('rename', map)">
          <template #icon><Pencil :size="17" aria-hidden="true" /></template>
        </ActionButton>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ActionButton, AddButton } from '@sylvieshare/share-ui'
import { Image, Map, MonitorUp, Pencil } from '@lucide/vue'

defineProps({ maps: { type: Array, required: true }, selected: String, onAir: String, busy: Boolean })
const emit = defineEmits(['add', 'select', 'rename'])
</script>

<style scoped>
.session-map-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: var(--spacing-medium); }
.session-map-list ul { display: grid; gap: var(--spacing-xs); margin: var(--spacing-small) 0 0; padding: 0; list-style: none; }
.session-map-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-xs); }
.session-map-list li > .session-map-list__select { justify-content: flex-start; min-width: 0; text-align: left; --action-button-min-height: var(--layout-touch-min); }
.session-map-list__select > :deep(svg) { flex: none; }
.session-map-list__label { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.session-map-list__label small { display: flex; align-items: center; gap: 4px; color: var(--success); }
.session-map-list__select[aria-pressed="true"] small { color: inherit; }
</style>
