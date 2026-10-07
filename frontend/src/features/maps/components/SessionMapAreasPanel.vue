<template>
  <section class="session-map-areas" aria-label="Области карты">
    <ToggleSwitch :model-value="map.state.fog" label="Туман войны" :disabled="controller.conflict"
      @update:model-value="controller.change(s => { s.fog = $event })" />
    <div class="map-tool-grid">
      <ActionButton variant="secondary" :disabled="controller.conflict" @click="all(true)">
        <Eye :size="15" />Открыть всё
      </ActionButton>
      <ActionButton variant="secondary" :disabled="controller.conflict" @click="all(false)">
        <EyeOff :size="15" />Скрыть всё
      </ActionButton>
    </div>
    <ToggleSwitch v-for="area in map.document.areas" :key="area.id"
      :model-value="map.state.areas?.[area.id] ?? !area.hidden" :label="area.name"
      :disabled="controller.conflict" @update:model-value="setArea(area.id, $event)" />
    <div v-for="zone in map.document.zones" :key="zone.id" class="session-map-zone">
      <button type="button" @click="emit('zone', zone.id)">{{ zone.name }}</button>
      <ToggleSwitch :model-value="map.state.zones[zone.id] === 'visible'"
        :label="`Показывать ${zone.name}`" :disabled="controller.conflict"
        @update:model-value="controller.change(s => { s.zones[zone.id] = $event ? 'visible' : 'hidden' })" />
    </div>
    <p v-if="!map.document.areas.length && !map.document.zones.length" class="map-hint">
      Областей пока нет. Подготовьте их в редакторе исходной карты.
    </p>
    <p class="map-hint">Скрытая геометрия видна мастеру полупрозрачной. В виде игроков она убрана; туман закрывает неоткрытые участки.</p>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { Eye, EyeOff } from '@lucide/vue'
const props = defineProps({ controller: { type: Object, required: true } })
const emit = defineEmits(['zone'])
const map = computed(() => props.controller.selected)
function setArea(id, visible) {
  props.controller.change(state => { (state.areas ||= {})[id] = visible })
}
function all(visible) {
  props.controller.change(state => {
    state.defaultVisibility = visible ? 'visible' : 'hidden'
    state.zones = Object.fromEntries(map.value.document.zones.map(zone => [zone.id, state.defaultVisibility]))
    state.areas = Object.fromEntries(map.value.document.areas.map(area => [area.id, visible]))
  })
}
</script>
<style scoped>
.session-map-areas { display: flex; flex-direction: column; gap: 14px; }
.session-map-zone { display: flex; flex-direction: column; gap: 7px; padding-block: 7px; border-bottom: 1px solid var(--border-strong); }
.session-map-zone button { padding: 0; border: 0; background: none; font: inherit; color: var(--text-1); text-align: left; cursor: pointer; }
</style>
