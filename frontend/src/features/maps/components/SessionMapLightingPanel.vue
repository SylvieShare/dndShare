<template>
  <MapLightingControls :enabled="lighting.enabled" :sun="lighting.sun" :disabled="controller.conflict"
    @update:enabled="change(l => { l.enabled = $event })"
    @update:sun="(field, value) => change(l => { l.sun[field] = value })">
    <MapEntityRow v-for="light in lights" :key="light.id" :entry="light" toggle-light :selectable="false"
      :toggle-disabled="disabled || (!light.enabled && light.item.shadows && shadowCount >= 2)" @toggle="toggle" />
    <p v-if="!lights.length" class="map-hint">Источников нет. Добавьте их в редакторе исходной карты.</p>
    <p v-if="shadowCount >= 2" class="map-hint">Одновременно тени создают до двух источников.</p>
  </MapLightingControls>
</template>
<script setup>
import { computed } from 'vue'
import { changeSessionLighting, sessionLighting, sessionMapDocument } from '../lib/sessionMapPresentation'
import { mapEntity } from '../lib/editorEntities'
import MapLightingControls from './MapLightingControls.vue'
import MapEntityRow from './MapEntityRow.vue'
const props = defineProps({ controller: { type: Object, required: true } })
const map = computed(() => props.controller.selected)
const lighting = computed(() => sessionLighting(map.value.document, map.value.state))
const document = computed(() => sessionMapDocument(map.value.document, map.value.state))
const lights = computed(() => document.value.lights.map(light => mapEntity(document.value, [], 'light', light.id)))
const shadowCount = computed(() => lights.value.filter(light => light.enabled && light.item.shadows).length)
const disabled = computed(() => props.controller.conflict || !lighting.value.enabled)
function change(update) {
  props.controller.change(state => changeSessionLighting(map.value.document, state, update))
}
function toggle(id) {
  const enabled = !lights.value.find(light => light.id === id).enabled
  change(l => { l.lights[id] = enabled })
}
</script>
