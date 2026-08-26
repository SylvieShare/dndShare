<template>
  <div ref="root" class="br-block">
    <BaseTile class="br-tile">
      <BlockResourcesView
        :resources="resources"
        :manage="ownerMode"
        :can-interact="ownerMode"
        @toggle="toggle"
        @manage="onManage"
      />
    </BaseTile>

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      @close="close"
    >
      <template #view="{ revealed }">
        <BlockResourcesView
          :resources="resources"
          :manage="ownerMode"
          :can-interact="ownerMode"
          :edit-fade="revealed"
          panel
          @toggle="toggle"
        />
      </template>
      <template #editor>
        <BlockResourcesEditor
          :resources="manualResources"
          :readonly-resources="readonlyResources"
          @reorder="reorder"
          @change-color="changeColor"
          @rename="rename"
          @set-total="setTotal"
          @set-rest="setRest"
          @remove="remove"
          @add="add"
        />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import BlockResourcesEditor from '@/features/character-editor/blocks/generic/components/BlockResourcesEditor'
import BlockResourcesView from '@/features/character-editor/blocks/generic/components/BlockResourcesView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { featureActionResourceKeys } from '@/features/character-editor/lib/characterFeatureActions'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const root = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const manualResources = computed(() => Array.isArray(props.value) ? props.value : [])
const allResources = computed(() => {
  const contributed = charCtx.characterResources?.resources
  if (Array.isArray(contributed)) return contributed
  if (Array.isArray(contributed?.value)) return contributed.value
  return manualResources.value
})
const actionResourceKeys = computed(() => featureActionResourceKeys(
  charCtx.values?.value || charCtx.values || {},
  charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map(),
  allResources.value,
))
const resources = computed(() => allResources.value.filter(resource => !actionResourceKeys.value.has(String(resource.key))))
const readonlyResources = computed(() => allResources.value.filter((resource) => resource.readonly))
const ownerMode = computed(() => charCtx.ownerMode)

function emitResources(next) {
  emit('update:value', props.block.id, next)
}

function onManage() {
  openFrom(root.value)
}

function toggle(ri, p) {
  if (!ownerMode.value) return
  const current = resources.value[ri]
  const nextValue = p <= current.value ? p - 1 : p
  const patch = current.key && charCtx.characterResources?.setAvailable
    ? charCtx.characterResources.setAvailable(current.key, nextValue)
    : { [props.block.id]: manualResources.value.map((r, i) => i === ri ? { ...r, value: nextValue } : r) }
  for (const [id, value] of Object.entries(patch || {})) emit('update:value', id, value)
  if (nextValue < Number(current.value)) {
    charCtx.logSessionEvent?.({
      type: 'resource_used',
      action: `Использовано: ${current.title || 'Ресурс'}`,
      data: { remaining: nextValue, total: Number(current.total) || 0 },
    })
  }
}

function setTotal(ri, total) {
  const t = Math.max(0, parseInt(total) || 0)
  emitResources(manualResources.value.map((r, i) => i === ri ? { ...r, total: t, value: Math.min(r.value, t) } : r))
}

function rename(ri, title) {
  emitResources(manualResources.value.map((r, i) => i === ri ? { ...r, title } : r))
}

function changeColor(ri, color_point) {
  emitResources(manualResources.value.map((r, i) => i === ri ? { ...r, color_point } : r))
}

function setRest(ri, kind, value) {
  emitResources(manualResources.value.map((r, i) => i === ri ? { ...r, [kind]: !!value } : r))
}

function remove(ri) {
  emitResources(manualResources.value.filter((_, i) => i !== ri))
}

function reorder(next) {
  emitResources(next)
}

function add(title, color_point) {
  emitResources([...manualResources.value, { title, color_point, value: 0, total: 0, short_rest: false, long_rest: false }])
}
</script>

<style scoped>
.br-block { min-width: 0; }

.br-tile {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
</style>
