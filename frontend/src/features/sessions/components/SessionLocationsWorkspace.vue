<template>
  <SessionLibraryWorkspace variant="locations">
    <aside class="session-world-sidebar">
      <div class="session-world-sidebar-head">
        <div>
          <span class="session-world-eyebrow">МИР СЕССИИ</span>
          <strong>Локации</strong>
        </div>
        <button v-if="isDm" type="button" class="session-world-add" title="Новая локация" aria-label="Новая локация" @click="openCreate()">
          <Plus :size="16" />
        </button>
      </div>

      <label class="session-world-search">
        <Search :size="14" />
        <input v-model="query" type="search" placeholder="Найти место…" />
        <kbd v-if="showShortcutHints" class="session-world-list-navigation-hint">↑ ↓</kbd>
        <kbd v-else-if="!query">⌘ K</kbd>
      </label>

      <div v-if="locations.length" ref="listElement" class="location-tree" @dragover.prevent @drop="dropAtRoot">
        <LocationTreeRow
          v-for="node in filteredForest"
          :key="node.id"
          :node="node"
          :selected-id="selectedLocationId"
          :expanded-ids="expandedIds"
          :editable="isDm && !world.saving.value"
          :force-expanded="!!query.trim()"
          @select="$emit('select-location', $event)"
          @toggle="toggleExpanded"
          @edit="openEdit"
          @drop-location="moveByDrop"
        />
        <div v-if="query && !filteredForest.length" class="session-world-list-empty">Ничего не найдено</div>
      </div>
      <div v-else class="session-world-sidebar-empty">
        <Map :size="28" />
        <strong>Карта начинается с места</strong>
        <span>Добавьте город, регион или подземелье, а детали вложите внутрь.</span>
        <button v-if="isDm" type="button" @click="openCreate()">Создать первую локацию</button>
      </div>

      <div v-if="isDm && locations.length" class="session-world-drag-hint">
        Перетаскивайте строки для порядка и вложенности
      </div>
    </aside>

    <SessionEntityDetail
      v-if="selectedLocation"
      :title="selectedLocation.name"
      :accent="selectedKind.color"
      :cover-url="sessionImageUrl(selectedLocation)"
      :editable="isDm"
      edit-aria-label="Редактировать локацию"
      @edit="openEdit(selectedLocation)"
    >
      <template #visual><img :src="sessionImageUrl(selectedLocation)" alt="" /></template>
      <template #context>
          <div class="session-world-breadcrumbs">
            <button
              v-for="item in breadcrumbs.slice(0, -1)"
              :key="item.id"
              type="button"
              @click="$emit('select-location', item.id)"
            >{{ item.name }}</button>
          </div>
      </template>
      <template #eyebrow><component :is="selectedKindIcon" :size="14" />{{ selectedKind.label }}</template>
      <template #meta>
        <span>{{ childLocations.length }} {{ ruPlural(childLocations.length, 'вложенное место', 'вложенных места', 'вложенных мест') }}</span>
        <span>{{ selectedLocation.relations?.length || 0 }} связей</span>
      </template>
      <template v-if="isDm" #actions-before>
          <button type="button" @click="openCreate(selectedLocation.id)"><FolderPlus :size="15" />Вложить место</button>
          <button type="button" @click="openNpcCreate"><UserPlus :size="15" />Добавить NPC</button>
      </template>

      <section class="session-world-section session-world-description">
        <div class="session-world-section-title"><span>О месте</span></div>
        <p v-if="selectedLocation.description">{{ selectedLocation.description }}</p>
        <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedLocation)">
          Добавить описание и атмосферу
        </button>
        <p v-else class="session-world-muted">Описание пока не добавлено.</p>
      </section>

      <section v-if="childLocations.length" class="session-world-section">
        <div class="session-world-section-title"><span>Внутри</span><small>{{ childLocations.length }}</small></div>
        <div class="session-world-card-grid">
          <button
            v-for="location in childLocations"
            :key="location.id"
            type="button"
            class="session-world-link-card session-world-link-card--image"
            :style="{ '--card-image': `url(${sessionImageUrl(location)})`, '--entity-color': locationKind(location.kind).color }"
            @click="$emit('select-location', location.id)"
          >
            <span>{{ locationKind(location.kind).shortLabel }}</span>
            <strong>{{ location.name }}</strong>
            <ChevronRight :size="15" />
          </button>
        </div>
      </section>

      <section class="session-world-section">
        <div class="session-world-section-title"><span>Связи</span><small>{{ selectedLocation.relations?.length || 0 }}</small></div>
        <UniversalRelationList :relations="selectedLocation.relations" :items="relationItems" @open="openRelated" />
      </section>
      <section class="session-world-section">
        <div class="session-world-section-title"><span>На холстах сценариев</span><small>{{ selectedLocation.scenarioUsages?.length || 0 }}</small></div>
        <ScenarioUsageList :usages="selectedLocation.scenarioUsages" :scenes="world.scenes.value" @open="openScenario" />
      </section>
    </SessionEntityDetail>

    <main v-else class="session-world-detail session-world-detail--empty">
      <MapPinned :size="44" />
      <strong>{{ locations.length ? 'Выберите локацию в дереве' : 'Здесь появится ваш мир' }}</strong>
      <span>Структура помогает быстро понять, что находится внутри города, здания или подземелья.</span>
    </main>

    <div v-if="world.error.value" class="session-world-error" role="alert">{{ world.error.value }}</div>

    <LocationEditorModal
      v-if="locationEditorOpen"
      :location="editingLocation"
      :locations="locations"
      :npcs="npcs"
      :default-parent-id="defaultParentId"
      :saving="world.saving.value"
	  :relation-items="relationItems"
      @close="closeEditors"
      @save="saveLocation"
      @delete="requestLocationDelete"
    />
    <NpcEditorModal
      v-if="npcEditorOpen"
      :locations="locations"
      :locations-by-id="world.locationsById.value"
      :default-location-id="selectedLocation?.id"
      :saving="world.saving.value"
	  :relation-items="relationItems"
      @close="closeEditors"
      @save="saveNpc"
    />
    <ConfirmDialog
      v-if="pendingDelete"
      title="Удалить локацию?"
      :message="`«${pendingDelete.name}» будет удалена вместе со своими привязками. Вложенные локации сначала нужно перенести.`"
      confirm-label="Удалить"
      :loading="world.saving.value"
      @cancel="pendingDelete = null"
      @confirm="deleteLocation"
    />
  </SessionLibraryWorkspace>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  Blocks, ChevronRight, Compass, DoorOpen, FolderPlus, House, Landmark,
  Map, MapPin, MapPinned, Plus, Route, Search, Trees, UserPlus,
} from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import LocationEditorModal from '@/features/sessions/components/LocationEditorModal.vue'
import LocationTreeRow from '@/features/sessions/components/LocationTreeRow.vue'
import NpcEditorModal from '@/features/sessions/components/NpcEditorModal.vue'
import SessionEntityDetail from '@/features/sessions/components/SessionEntityDetail.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import ScenarioUsageList from '@/features/sessions/components/ScenarioUsageList.vue'
import UniversalRelationList from '@/features/sessions/components/UniversalRelationList.vue'
import {
  buildLocationForest, locationBreadcrumb, locationDescendantIds, locationKind,
  locationSearchMatches, ruPlural,
} from '@/features/sessions/lib/sessionWorld'
import { sessionImageUrl } from '@/features/sessions/lib/sessionImages'
import { adjacentSessionListItemId, scrollSessionListItemIntoView } from '@/features/sessions/lib/sessionListNavigation'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  world: { type: Object, required: true },
  selectedLocationId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
	relationItems: { type: Array, default: () => [] },
	showShortcutHints: { type: Boolean, default: false },
})
const emit = defineEmits(['select-location', 'open-npc', 'open-entity'])
const locations = computed(() => props.world.locations.value)
const npcs = computed(() => props.world.npcs.value)
const selectedLocation = computed(() => props.world.locationsById.value.get(Number(props.selectedLocationId)) || null)
const query = ref('')
const expandedIds = ref(readExpanded())
const locationEditorOpen = ref(false)
const editingLocation = ref(null)
const defaultParentId = ref(null)
const npcEditorOpen = ref(false)
const pendingDelete = ref(null)
const listElement = ref(null)

const icons = { compass: Compass, landmark: Landmark, blocks: Blocks, house: House, door: DoorOpen, trees: Trees, route: Route, 'map-pin': MapPin }
const selectedKind = computed(() => locationKind(selectedLocation.value?.kind))
const selectedKindIcon = computed(() => icons[selectedKind.value.icon] || MapPin)
const forest = computed(() => buildLocationForest(locations.value))
const filteredForest = computed(() => {
  const filter = nodes => nodes.flatMap(node => {
    const children = filter(node.children)
    return locationSearchMatches(node, query.value.trim()) || children.length ? [{ ...node, children }] : []
  })
  return query.value.trim() ? filter(forest.value) : forest.value
})
const visibleLocations = computed(() => {
	const result = []
	const forceExpanded = !!query.value.trim()
	const visit = nodes => nodes.forEach(node => {
		result.push(node)
		if (forceExpanded || expandedIds.value.has(node.id)) visit(node.children)
	})
	visit(filteredForest.value)
	return result
})
const breadcrumbs = computed(() => locationBreadcrumb(selectedLocation.value, props.world.locationsById.value))
const childLocations = computed(() => locations.value.filter(location => location.parentLocationId === selectedLocation.value?.id).sort((a, b) => a.sortOrder - b.sortOrder))

function expandedKey() { return `dnd-share:session-location-tree:v1:${props.sessionUuid}` }
function readExpanded() {
  try { return new Set(JSON.parse(localStorage.getItem(expandedKey()) || '[]').map(Number)) } catch { return new Set() }
}
function persistExpanded() {
  try { localStorage.setItem(expandedKey(), JSON.stringify([...expandedIds.value])) } catch { /* ignore */ }
}
function toggleExpanded(id) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
  persistExpanded()
}
function expandAncestors(location) {
  const next = new Set(expandedIds.value)
  locationBreadcrumb(location, props.world.locationsById.value).slice(0, -1).forEach(item => next.add(item.id))
  expandedIds.value = next
  persistExpanded()
}

function openCreate(parentId = null) {
  editingLocation.value = null
  defaultParentId.value = parentId
  locationEditorOpen.value = true
}
function openEdit(location) {
  editingLocation.value = location
  defaultParentId.value = null
  locationEditorOpen.value = true
}
function openNpcCreate() { npcEditorOpen.value = true }
function openRelated(item) {
	if (item.type === 'location') emit('select-location', item.id)
	else if (item.type === 'npc') emit('open-npc', item.id)
	else emit('open-entity', item)
}
function openScenario(id) { emit('open-entity', { type: 'scene', id }) }
function closeEditors() {
  locationEditorOpen.value = false
  npcEditorOpen.value = false
  editingLocation.value = null
  defaultParentId.value = null
}
async function saveLocation(data) {
  try {
    const id = await props.world.saveLocation(editingLocation.value, data)
    closeEditors()
    if (data.parentLocationId) {
      const next = new Set(expandedIds.value); next.add(data.parentLocationId); expandedIds.value = next; persistExpanded()
    }
    emit('select-location', id || editingLocation.value?.id)
  } catch { /* error is rendered */ }
}
async function saveNpc(data) {
  try { await props.world.saveNpc(null, data); closeEditors() } catch { /* error is rendered */ }
}
function requestLocationDelete(location) {
  locationEditorOpen.value = false
  pendingDelete.value = location
}
async function deleteLocation() {
  const location = pendingDelete.value
  if (!location) return
  try {
    await props.world.removeLocation(location.id)
    pendingDelete.value = null
    emit('select-location', location.parentLocationId || locations.value[0]?.id || null)
  } catch { /* error is rendered */ }
}

async function moveByDrop({ sourceId, target, mode }) {
  if (locationDescendantIds(sourceId, locations.value).has(target.id)) return
  let parentLocationId = mode === 'inside' ? target.id : target.parentLocationId || null
  let beforeLocationId = mode === 'before' ? target.id : null
  if (mode === 'after') {
    const siblings = locations.value
      .filter(item => (item.parentLocationId || null) === parentLocationId && item.id !== sourceId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const targetIndex = siblings.findIndex(item => item.id === target.id)
    beforeLocationId = siblings[targetIndex + 1]?.id || null
  }
  try {
    await props.world.moveLocation(sourceId, { parentLocationId, beforeLocationId })
    if (mode === 'inside') {
      const next = new Set(expandedIds.value); next.add(target.id); expandedIds.value = next; persistExpanded()
    }
    emit('select-location', sourceId)
  } catch { /* error is rendered */ }
}
async function dropAtRoot(event) {
  if (!props.isDm || event.target.closest('.location-tree-row')) return
  const sourceId = Number(event.dataTransfer.getData('application/x-session-location') || event.dataTransfer.getData('text/plain'))
  if (!Number.isInteger(sourceId)) return
  try { await props.world.moveLocation(sourceId, { parentLocationId: null, beforeLocationId: null }); emit('select-location', sourceId) } catch { /* rendered */ }
}

function moveSelection(direction) {
	const id = adjacentSessionListItemId(visibleLocations.value, props.selectedLocationId, direction)
	if (id == null) return
	if (String(id) !== String(props.selectedLocationId)) emit('select-location', id)
	scrollSessionListItemIntoView(listElement.value, id)
}

watch(selectedLocation, location => { if (location) expandAncestors(location) })

defineExpose({ moveSelection })
</script>
