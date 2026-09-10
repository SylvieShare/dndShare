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

    <SessionEntityForm
      v-if="selectedLocation"
      :key="selectedLocation.id"
      type="location"
      :entity="selectedLocation"
      :editable="isDm"
      :editing="detailEditing"
      :saving="world.saving.value"
      :locations="locations"
      :relation-items="relationItems"
      :save="saveDetail"
      @edit-request="detailEditing = true"
      @cancel="detailEditing = false"
      @saved="detailEditing = false"
      @open-entity="openRelated"
    >
      <SessionEntityDetail
        :title="selectedLocation.name"
        :accent="selectedKind.color"
        :cover-url="detailEditing ? '' : sessionImageUrl(selectedLocation)"
        :back-label="backLabel"
        @back="$emit('back')"
      >
        <template #visual><SessionEntityFormVisual /></template>
        <template #heading><SessionEntityFormHeader /></template>
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
        <template v-if="isDm" #actions-after><button type="button" class="danger" aria-label="Удалить объект" @click="requestLocationDelete(selectedLocation)"><Trash2 :size="15" /></button></template>
        <template #meta>
          <span>{{ childLocations.length }} {{ ruPlural(childLocations.length, 'вложенное место', 'вложенных места', 'вложенных мест') }}</span>
          <span>{{ selectedLocation.relations?.length || 0 }} связей</span>
        </template>
        <template v-if="isDm" #actions-before>
            <button type="button" @click="openCreate(selectedLocation.id)"><FolderPlus :size="15" />Вложить место</button>
            <button type="button" @click="openNpcCreate"><UserPlus :size="15" />Добавить NPC</button>
        </template>

        <section v-if="!detailEditing && childLocations.length" class="session-world-section">
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
          <SessionEntityFormBody />
        </section>
        <section v-if="!detailEditing" class="session-world-section">
          <div class="session-world-section-title"><span>На холстах сценариев</span><small>{{ selectedLocation.scenarioUsages?.length || 0 }}</small></div>
          <ScenarioUsageList :usages="selectedLocation.scenarioUsages" :scenes="world.scenes.value" @open="openScenario" />
        </section>
      </SessionEntityDetail>
    </SessionEntityForm>

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
  ChevronRight, FolderPlus, Map, MapPinned, Plus, Search, UserPlus,
} from '@lucide/vue'
import { Trash2 } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import LocationEditorModal from '@/features/sessions/components/LocationEditorModal.vue'
import LocationTreeRow from '@/features/sessions/components/LocationTreeRow.vue'
import NpcEditorModal from '@/features/sessions/components/NpcEditorModal.vue'
import SessionEntityDetail from '@/features/sessions/components/SessionEntityDetail.vue'
import SessionEntityForm from '@/features/sessions/components/SessionEntityForm.vue'
import SessionEntityFormBody from './SessionEntityFormBody.vue'
import SessionEntityFormHeader from './SessionEntityFormHeader.vue'
import SessionEntityFormVisual from './SessionEntityFormVisual.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import ScenarioUsageList from '@/features/sessions/components/ScenarioUsageList.vue'
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
  backLabel: { type: String, default: '' },
})
const emit = defineEmits(['select-location', 'open-npc', 'open-entity', 'back'])
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

const selectedKind = computed(() => locationKind(selectedLocation.value?.kind))
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

const detailEditing = ref(false)
const pendingEditLocationId = ref(null)
watch(() => selectedLocation.value?.id, id => {
  detailEditing.value = id === pendingEditLocationId.value
  pendingEditLocationId.value = null
})
async function saveDetail(payload) {
  if (!props.isDm || props.world.saving.value) return false
  const entity = selectedLocation.value
  if (!entity) return false
  await props.world.saveLocation(entity, payload)
  return true
}

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
  if (selectedLocation.value?.id === location.id) detailEditing.value = true
  else { pendingEditLocationId.value = location.id; emit('select-location', location.id) }
}
function openNpcCreate() { npcEditorOpen.value = true }
function openRelated(item) {
	emit('open-entity', item)
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
