<template>
  <section class="map-lighting-panel" aria-label="Освещение карты">
    <ToggleSwitch :model-value="enabled" label="Освещение" :disabled="disabled"
      @update:model-value="emit('update:enabled', $event)" />
    <MapSunSettings :sun="sun" :enabled="enabled" :disabled="disabled"
      @update="(field, value) => emit('update:sun', field, value)" @finish="emit('finish')" />
    <DetailSection label="Источники света">
      <div class="map-light-sources"><slot /></div>
    </DetailSection>
  </section>
</template>
<script setup>
import { DetailSection, ToggleSwitch } from '@sylvieshare/share-ui'
import MapSunSettings from './MapSunSettings.vue'
import { DEFAULT_SUN } from '../lib/mapLighting'
defineProps({ enabled: Boolean, disabled: Boolean, sun: { type: Object, default: () => ({ ...DEFAULT_SUN }) } })
const emit = defineEmits(['update:enabled', 'update:sun', 'finish'])
</script>
<style scoped>
.map-lighting-panel { display: flex; flex-direction: column; gap: 12px; }
.map-light-sources { display: flex; flex-direction: column; gap: 8px; }
</style>
