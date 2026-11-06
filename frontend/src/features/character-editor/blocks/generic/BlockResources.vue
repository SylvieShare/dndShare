<template>
  <BlockResourcesView v-bind="$attrs" class="br-block"
    :resources="resources"
    :manage="ownerMode"
    :can-interact="ownerMode"
    @toggle="toggle"
    @manage="onManage"
  />

  <AppModalFrame v-if="editorOpen" title="Ресурсы" :width="540" :z-index="3100" @close="editorOpen = false">
    <BlockResourcesEditor
      :resources="manualResources"
      :readonly-resources="readonlyResources"
      @reorder="reorder"
      @change-color="changeColor"
      @rename="rename"
      @set-total="setTotal"
      @set-rest="setRest"
      @set-visible="setVisible"
      @remove="remove"
      @add="add"
    />
  </AppModalFrame>
</template>

<script setup>
import { logResourceChange } from '@/features/character-editor/lib/sessionEventData'

import { computed, inject, ref } from 'vue'
import BlockResourcesEditor from '@/features/character-editor/blocks/generic/components/BlockResourcesEditor'
import BlockResourcesView from '@/features/character-editor/blocks/generic/components/BlockResourcesView'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { resourceVisibleHere, resourceVisibilityPatch } from '@/features/character-editor/lib/resourceVisibility'
import { featureWidgetResourceKeys } from '@/features/character-editor/lib/characterFeatureWidgets'
import { featureActionResourceKeys } from '@/features/character-editor/lib/characterFeatureActions'

defineOptions({ inheritAttrs: false })
const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const editorOpen = ref(false)

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
const widgetResourceKeys = computed(() => featureWidgetResourceKeys(
  charCtx.values?.value || charCtx.values || {},
  charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map(),
  allResources.value,
))
const values = computed(() => charCtx.values?.value || charCtx.values || {})
const visibleHere = resource => resourceVisibleHere(resource, values.value, actionResourceKeys.value, widgetResourceKeys.value)
const resources = computed(() => allResources.value.filter(visibleHere))
const readonlyResources = computed(() => allResources.value.filter((resource) => resource.readonly).map(resource => ({ ...resource, visible_here: visibleHere(resource) })))
const ownerMode = computed(() => charCtx.ownerMode)

function setVisible(key, visible) {
  if (!ownerMode.value) return
  const patch = resourceVisibilityPatch(values.value, key, visible)
  if (charCtx.updateValues) charCtx.updateValues(patch)
  else for (const [id, value] of Object.entries(patch)) emit('update:value', id, value)
}

function emitResources(next) {
  emit('update:value', props.block.id, next)
}

function onManage() {
  editorOpen.value = true
}

function toggle(ri, p) {
  if (!ownerMode.value) return
  const current = resources.value[ri]
  const nextValue = p <= current.value ? p - 1 : p
  const patch = current.key && charCtx.characterResources?.setAvailable
    ? charCtx.characterResources.setAvailable(current.key, nextValue)
    : { [props.block.id]: manualResources.value.map((r, i) => i === ri ? { ...r, value: nextValue } : r) }
  for (const [id, value] of Object.entries(patch || {})) emit('update:value', id, value)
  logResourceChange(charCtx, current, nextValue)
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
.br-block { width: 100%; min-width: 0; box-sizing: border-box; }
</style>
