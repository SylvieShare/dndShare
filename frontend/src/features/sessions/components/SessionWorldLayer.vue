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
	ref="activeWorkspace"
    :session-uuid="sessionUuid"
    :world="world"
    :selected-location-id="selectedLocationId"
    :is-dm="isDm"
	:relation-items="relationItems"
	:back-label="backLabel"
	:show-shortcut-hints="showShortcutHints"
	@back="goBack"
    @select-location="navigateDirect('location', $event)"
    @open-npc="navigateDirect('npc', $event)"
	@open-entity="openEntity"
  />
  <SessionNpcsWorkspace
    v-else-if="activeView === 'npcs'"
	ref="activeWorkspace"
    :world="world"
    :selected-npc-id="selectedNpcId"
    :is-dm="isDm"
	:relation-items="relationItems"
	:back-label="backLabel"
	:show-shortcut-hints="showShortcutHints"
	@back="goBack"
    @select-npc="navigateDirect('npc', $event)"
    @open-location="navigateDirect('location', $event)"
	@open-entity="openEntity"
  />
  <SessionMaterialsWorkspace
    v-else-if="activeView === 'materials'"
	ref="activeWorkspace"
    :materials="materials"
    :presentation="presentation"
    :is-dm="isDm"
	:world="world"
	:relation-items="relationItems"
	:back-label="backLabel"
	:selected-material-id="selectedMaterialId"
	:show-shortcut-hints="showShortcutHints"
	@open-entity="openEntity"
	@back="goBack"
	@select-material="navigateDirect('material', $event)"
  />
	<SessionQuestsWorkspace
		v-else-if="activeView === 'quests'"
		ref="activeWorkspace"
		:world="world"
		:selected-quest-id="selectedQuestId"
		:is-dm="isDm"
		:relation-items="relationItems"
		:back-label="backLabel"
		:show-shortcut-hints="showShortcutHints"
		@back="goBack"
		@select-quest="navigateDirect('quest', $event)"
		@open-entity="openEntity"
	/>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { AlertCircle, Map } from '@lucide/vue'
import SessionLocationsWorkspace from '@/features/sessions/components/SessionLocationsWorkspace.vue'
import SessionNpcsWorkspace from '@/features/sessions/components/SessionNpcsWorkspace.vue'
import SessionMaterialsWorkspace from '@/features/sessions/components/SessionMaterialsWorkspace.vue'
import SessionQuestsWorkspace from '@/features/sessions/components/SessionQuestsWorkspace.vue'
import { useSessionEntityNavigationHistory } from '@/features/sessions/composables/useSessionEntityNavigationHistory'
import { buildSessionEntityCatalog, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  activeView: { type: String, required: true },
  selectedLocationId: { type: [Number, String], default: null },
  selectedNpcId: { type: [Number, String], default: null },
	selectedQuestId: { type: [Number, String], default: null },
	selectedMaterialId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
  materials: { type: Object, default: null },
	presentation: { type: Object, default: null },
	showShortcutHints: { type: Boolean, default: false },
	world: { type: Object, required: true },
})
const emit = defineEmits(['select-location', 'select-npc', 'select-quest', 'select-material', 'open-scene'])
const world = props.world
const activeWorkspace = ref(null)
const relationItems = computed(() => buildSessionEntityCatalog(world, props.materials))
const navigationHistory = useSessionEntityNavigationHistory(props.sessionUuid)
const activeEntityType = computed(() => ({ locations: 'location', npcs: 'npc', quests: 'quest', materials: 'material' })[props.activeView] || null)
const activeEntityId = computed(() => ({
  location: props.selectedLocationId,
  npc: props.selectedNpcId,
  quest: props.selectedQuestId,
  material: props.selectedMaterialId,
})[activeEntityType.value] || null)
const currentEntity = computed(() => relationItems.value.find(item => item.key === sessionEntityKey(activeEntityType.value, activeEntityId.value)) || null)
const backLabel = computed(() => navigationHistory.backTarget.value ? `Назад к «${navigationHistory.backTarget.value.title}»` : '')

watch(() => props.activeView, view => {
	if (view !== 'story') {
		world.load(view !== 'materials').catch(() => {})
		props.materials?.load(view === 'materials').catch(() => {})
	}
}, { immediate: true })

watch(
	[world.loaded, () => props.activeView, world.locations, world.npcs, world.quests, () => props.selectedLocationId, () => props.selectedNpcId, () => props.selectedQuestId],
	([loaded, view, locations, npcs, quests, locationId, npcId, questId]) => {
    if (!loaded) return
    if (view === 'locations' && locations.length && !locations.some(location => location.id === Number(locationId))) {
      emit('select-location', locations[0].id)
    }
    if (view === 'npcs' && npcs.length && !npcs.some(npc => npc.id === Number(npcId))) {
      emit('select-npc', npcs[0].id)
    }
		if (view === 'quests' && quests.length && !quests.some(quest => quest.id === Number(questId))) {
			emit('select-quest', quests[0].id)
		}
  },
  { immediate: true },
)

function openEntity(item) {
	if (item.type === 'scene') { emit('open-scene', item.id); return }
  if (!['location', 'npc', 'quest', 'material'].includes(item.type)) return
  const current = currentEntity.value
  if (current && current.key !== sessionEntityKey(item.type, item.id)) navigationHistory.push(current)
  emitEntity(item.type, item.id)
}

function emitEntity(type, id) {
	if (type === 'location') emit('select-location', id)
	if (type === 'npc') emit('select-npc', id)
	if (type === 'quest') emit('select-quest', id)
	if (type === 'material') emit('select-material', id)
}

function navigateDirect(type, id) {
  navigationHistory.clear()
  emitEntity(type, id)
}

function goBack() {
  const target = navigationHistory.pop()
  if (target) emitEntity(target.type, target.id)
}

defineExpose({
	moveSelection: direction => activeWorkspace.value?.moveSelection(direction),
})
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
