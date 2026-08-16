<template>
  <div class="location-tree-branch">
    <div
      class="location-tree-row"
      :class="{
        'location-tree-row--selected': selectedId === node.id,
        [`location-tree-row--drop-${dropMode}`]: !!dropMode,
      }"
      :style="{ '--tree-depth': depth, '--location-color': kind.color }"
      :draggable="editable"
      @click="$emit('select', node.id)"
      @dragstart="startDrag"
      @dragend="dropMode = ''"
      @dragover="dragOver"
      @dragleave="dropMode = ''"
      @drop="drop"
    >
      <button
        type="button"
        class="location-tree-chevron"
        :class="{ 'location-tree-chevron--open': expanded }"
        :disabled="!node.children.length"
        :aria-label="expanded ? 'Свернуть' : 'Развернуть'"
        @click.stop="$emit('toggle', node.id)"
      ><ChevronRight :size="14" /></button>

      <span class="location-tree-kind"><component :is="kindIcon" :size="14" /></span>
      <span class="location-tree-copy">
        <strong>{{ node.name }}</strong>
        <small>{{ kind.shortLabel }}</small>
      </span>
	  <span v-if="linkedNpcCount" class="location-tree-count" title="Связанные NPC">
		<UsersRound :size="11" />{{ linkedNpcCount }}
      </span>
      <button
        v-if="editable"
        type="button"
        class="location-tree-edit"
        title="Редактировать"
        aria-label="Редактировать локацию"
        @click.stop="$emit('edit', node)"
        @mousedown.stop
      ><Pencil :size="13" /></button>
    </div>

    <div v-if="expanded && node.children.length" class="location-tree-children">
      <LocationTreeRow
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-id="selectedId"
        :expanded-ids="expandedIds"
        :editable="editable"
        :force-expanded="forceExpanded"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
        @edit="$emit('edit', $event)"
        @drop-location="$emit('drop-location', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  Blocks,
  ChevronRight,
  Compass,
  DoorOpen,
  House,
  Landmark,
  MapPin,
  Pencil,
  Route,
  Trees,
  UsersRound,
} from '@lucide/vue'
import { locationKind } from '@/features/sessions/lib/sessionWorld'

defineOptions({ name: 'LocationTreeRow' })
const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  selectedId: { type: [Number, String], default: null },
  expandedIds: { type: Set, default: () => new Set() },
  editable: { type: Boolean, default: false },
  forceExpanded: { type: Boolean, default: false },
})
const linkedNpcCount = computed(() => (props.node.relations || []).filter(relation => relation.type === 'npc').length)
const emit = defineEmits(['select', 'toggle', 'edit', 'drop-location'])
const dropMode = ref('')
const kind = computed(() => locationKind(props.node.kind))
const expanded = computed(() => props.forceExpanded || props.expandedIds.has(props.node.id))
const icons = {
  compass: Compass,
  landmark: Landmark,
  blocks: Blocks,
  house: House,
  door: DoorOpen,
  trees: Trees,
  route: Route,
  'map-pin': MapPin,
}
const kindIcon = computed(() => icons[kind.value.icon] || MapPin)

function startDrag(event) {
  if (!props.editable) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-session-location', String(props.node.id))
  event.dataTransfer.setData('text/plain', String(props.node.id))
}

function dragOver(event) {
  if (!props.editable) return
  event.preventDefault()
  const bounds = event.currentTarget.getBoundingClientRect()
  const ratio = (event.clientY - bounds.top) / Math.max(bounds.height, 1)
  dropMode.value = ratio < 0.27 ? 'before' : ratio > 0.73 ? 'after' : 'inside'
  event.dataTransfer.dropEffect = 'move'
}

function drop(event) {
  if (!props.editable) return
  event.preventDefault()
  event.stopPropagation()
  const sourceId = Number(
    event.dataTransfer.getData('application/x-session-location')
      || event.dataTransfer.getData('text/plain'),
  )
  const mode = dropMode.value
  dropMode.value = ''
  if (!Number.isInteger(sourceId) || sourceId === props.node.id || !mode) return
  emit('drop-location', { sourceId, target: props.node, mode })
}
</script>

<style scoped>
.location-tree-branch { min-width: 0; }
.location-tree-row { position: relative; display: flex; min-width: 0; min-height: 42px; align-items: center; gap: 7px; padding: 4px 7px 4px calc(6px + var(--tree-depth) * 16px); border-radius: 8px; color: var(--text-2); cursor: pointer; transition: background 0.13s, color 0.13s; }
.location-tree-row:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); color: var(--text-1); }
.location-tree-row--selected { background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--text-1); }
.location-tree-row--drop-before::before, .location-tree-row--drop-after::after { position: absolute; right: 8px; left: calc(28px + var(--tree-depth) * 16px); height: 2px; border-radius: 2px; background: var(--accent); content: ''; }
.location-tree-row--drop-before::before { top: -1px; }
.location-tree-row--drop-after::after { bottom: -1px; }
.location-tree-row--drop-inside { box-shadow: inset 0 0 0 1px var(--accent); background: color-mix(in srgb, var(--accent) 11%, transparent); }
.location-tree-chevron, .location-tree-edit { display: grid; flex: none; place-items: center; padding: 0; border: 0; background: none; color: var(--text-muted); }
.location-tree-chevron { width: 18px; height: 26px; }
.location-tree-chevron svg { transition: transform 0.15s; }
.location-tree-chevron--open svg { transform: rotate(90deg); }
.location-tree-chevron:disabled { opacity: 0.16; }
.location-tree-kind { width: 28px; height: 28px; display: grid; flex: none; place-items: center; border: 1px solid color-mix(in srgb, var(--location-color) 42%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--location-color) 12%, transparent); color: var(--location-color); }
.location-tree-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 1px; }
.location-tree-copy strong, .location-tree-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.location-tree-copy strong { font-size: 12px; font-weight: 650; }
.location-tree-copy small { color: var(--text-muted); font-size: 9px; }
.location-tree-count { display: inline-flex; flex: none; align-items: center; gap: 3px; color: var(--text-muted); font-size: 9px; }
.location-tree-edit { width: 25px; height: 25px; border-radius: 6px; cursor: pointer; opacity: 0; }
.location-tree-row:hover .location-tree-edit, .location-tree-row--selected .location-tree-edit { opacity: 1; }
.location-tree-edit:hover { background: var(--surface-active); color: var(--text-1); }
</style>
