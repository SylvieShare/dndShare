<template>
  <MapLightingControls :enabled="editor.draft.document.lightingEnabled" :sun="editor.draft.document.sun"
    @update:enabled="editor.updateLightingMode" @update:sun="editor.updateSun" @finish="editor.finishLightEdit">
    <MapLightPresetMenu :disabled="manualLightCount(editor.draft.document) >= 32"
      @place-light="(kind, event) => emit('place-light', kind, event)" />
    <MapEntityRow v-for="light in lights" :key="light.id" :entry="light" toggle-light
      :selected="editor.selectedLight === light.id" @select="editor.selectLight(light.id)" @toggle="editor.toggleLight" />
  </MapLightingControls>
</template>
<script setup>
import { computed } from 'vue'
import { mapEntity } from '../lib/editorEntities'
import { manualLightCount } from '../lib/builtinLights'
import MapLightingControls from './MapLightingControls.vue'
import MapLightPresetMenu from './MapLightPresetMenu.vue'
import MapEntityRow from './MapEntityRow.vue'
const props = defineProps({ editor: Object })
const emit = defineEmits(['place-light'])
const lights = computed(() => props.editor.draft.document.lights.map(light =>
  mapEntity(props.editor.draft.document, props.editor.catalogue, 'light', light.id),
))
</script>
