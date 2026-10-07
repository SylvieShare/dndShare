<template>
  <section class="session-lighting" aria-label="Освещение карты">
    <ToggleSwitch :model-value="lighting.enabled" label="Освещение"
      :disabled="controller.conflict" @update:model-value="change(l => { l.enabled = $event })" />
    <DetailSection label="Дневное освещение">
      <ToggleSwitch :model-value="lighting.sun.enabled" label="Дневной свет"
        :disabled="disabled" @update:model-value="change(l => { l.sun.enabled = $event })" />
      <FormField :label="`Направление: ${Math.round(lighting.sun.angle)}°`" vertical>
        <AppSlider :model-value="lighting.sun.angle" :min="0" :max="360" :step="1"
          :disabled="sunDisabled" label="Направление дневного света"
          @update:model-value="change(l => { l.sun.angle = $event })" />
      </FormField>
      <FormField :label="`Высота над горизонтом: ${Math.round(lighting.sun.elevation)}°`" vertical>
        <AppSlider :model-value="lighting.sun.elevation" :min="10" :max="85" :step="1"
          :disabled="sunDisabled" label="Высота дневного света"
          @update:model-value="change(l => { l.sun.elevation = $event })" />
      </FormField>
    </DetailSection>
    <DetailSection label="Источники света">
      <ToggleSwitch v-for="light in lights" :key="light.id"
        :model-value="light.enabled" :label="light.name"
        :disabled="disabled || (!light.enabled && light.shadows && shadowCount >= 2)"
        @update:model-value="change(l => { l.lights[light.id] = $event })" />
      <p v-if="!lights.length" class="map-hint">Источников нет. Добавьте их в редакторе исходной карты.</p>
      <p v-if="shadowCount >= 2" class="map-hint">Одновременно тени создают до двух источников.</p>
    </DetailSection>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { AppSlider, DetailSection, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import { changeSessionLighting, sessionLighting, sessionMapDocument } from '../lib/sessionMapPresentation'
const props = defineProps({ controller: { type: Object, required: true } })
const map = computed(() => props.controller.selected)
const lighting = computed(() => sessionLighting(map.value.document, map.value.state))
const lights = computed(() => sessionMapDocument(map.value.document, map.value.state).lights)
const shadowCount = computed(() => lights.value.filter(light => light.enabled && light.shadows).length)
const disabled = computed(() => props.controller.conflict || !lighting.value.enabled)
const sunDisabled = computed(() => disabled.value || !lighting.value.sun.enabled)
function change(update) {
  props.controller.change(state => changeSessionLighting(map.value.document, state, update))
}
</script>
<style scoped>
.session-lighting { display: flex; flex-direction: column; gap: 16px; }
</style>
