<template>
  <div v-if="world.loading.value && !world.loaded.value" class="session-world-loading">
    <div class="session-world-loading-mark"><Map :size="24" /></div>
    <span>Собираем мир сессии…</span>
  </div>
  <div v-else-if="world.error.value && !world.loaded.value" class="session-world-loading session-world-loading--error">
    <AlertCircle :size="26" />
    <strong>Не удалось открыть раздел</strong>
    <span>{{ world.error.value }}</span>
    <button type="button" @click="world.load(true)">Попробовать снова</button>
  </div>
  <SessionLocationsWorkspace
    v-else-if="activeView === 'locations'"
    :session-uuid="sessionUuid"
    :world="world"
    :selected-location-id="selectedLocationId"
    :is-dm="isDm"
    @select-location="$emit('select-location', $event)"
    @open-npc="$emit('select-npc', $event)"
  />
  <SessionNpcsWorkspace
    v-else-if="activeView === 'npcs'"
    :world="world"
    :selected-npc-id="selectedNpcId"
    :is-dm="isDm"
    @select-npc="$emit('select-npc', $event)"
    @open-location="$emit('select-location', $event)"
  />
</template>

<script setup>
import { watch } from 'vue'
import { AlertCircle, Map } from '@lucide/vue'
import SessionLocationsWorkspace from '@/features/sessions/components/SessionLocationsWorkspace.vue'
import SessionNpcsWorkspace from '@/features/sessions/components/SessionNpcsWorkspace.vue'
import { useSessionWorld } from '@/features/sessions/composables/useSessionWorld'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  activeView: { type: String, required: true },
  selectedLocationId: { type: [Number, String], default: null },
  selectedNpcId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['select-location', 'select-npc'])
const world = useSessionWorld(props.sessionUuid)

watch(() => props.activeView, view => {
  if (view === 'locations' || view === 'npcs') world.load().catch(() => {})
}, { immediate: true })

watch(
  [world.loaded, () => props.activeView, world.locations, world.npcs, () => props.selectedLocationId, () => props.selectedNpcId],
  ([loaded, view, locations, npcs, locationId, npcId]) => {
    if (!loaded) return
    if (view === 'locations' && locations.length && !locations.some(location => location.id === Number(locationId))) {
      emit('select-location', locations[0].id)
    }
    if (view === 'npcs' && npcs.length && !npcs.some(npc => npc.id === Number(npcId))) {
      emit('select-npc', npcs[0].id)
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.session-world-loading { position: absolute; z-index: 5; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 9px; background-color: var(--app-canvas-bg); background-image: var(--app-canvas-pattern); background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size); color: var(--text-muted); font-size: 11px; }
.session-world-loading-mark { width: 54px; height: 54px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border)); border-radius: 16px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--accent-soft); animation: session-world-pulse 1.4s ease-in-out infinite; }
.session-world-loading--error > svg { color: var(--danger); }
.session-world-loading--error strong { color: var(--text-1); font-size: 13px; }
.session-world-loading--error button { padding: 7px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-raised); color: var(--text-1); font: inherit; font-size: 10px; cursor: pointer; }
@keyframes session-world-pulse { 50% { opacity: 0.48; transform: scale(0.96); } }
@media (prefers-reduced-motion: reduce) { .session-world-loading-mark { animation: none; } }
</style>
