<template>
  <TransitionGroup name="map-catalogue" tag="div" class="map-model-catalogue">
    <section
      v-for="section in sections"
      :key="section.key"
      class="map-model-section"
      :data-group-code="section.code"
      :aria-label="section.name"
    >
      <header>
        <h4>{{ section.name }}</h4>
        <small v-if="showIdentifiers">{{ section.code }}</small>
      </header>
      <div
        class="map-model-grid"
        :class="{ 'map-model-grid--compact': compact }"
      >
        <template v-for="family in section.variants" :key="family.key">
          <MapModelGroupCard
            v-if="family.models.length > 1"
            :group="family"
            :selected-id="selectedId"
            :show-identifiers="showIdentifiers"
            :draggable="draggable"
            @model="(id, event) => emit('model', id, event)"
            @drag-tile="(id, event) => emit('drag-tile', id, event)"
          />
          <MapTileCard
            v-else
            :model="family.models[0]"
            :selected="selectedId === family.models[0].id"
            :show-identifiers="showIdentifiers"
            :draggable="draggable"
            @model="(id, event) => emit('model', id, event)"
            @drag-tile="(id, event) => emit('drag-tile', id, event)"
          />
        </template>
      </div>
    </section>
  </TransitionGroup>
</template>
<script setup>
import { computed } from "vue";
import { modelGroups } from "../lib/modelGroups";
import MapModelGroupCard from "./MapModelGroupCard.vue";
import MapTileCard from "./MapTileCard.vue";
const props = defineProps({
  models: Array,
  catalogue: Array,
  selectedId: String,
  compact: Boolean,
  draggable: Boolean,
  showIdentifiers: Boolean,
});
const emit = defineEmits(["model", "drag-tile"]);
const sections = computed(() => modelGroups(props.models, props.catalogue));
</script>
<style scoped>
.map-model-catalogue {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.map-model-section {
  min-width: 0;
}
header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}
h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
small {
  color: var(--text-muted);
  font: 10px var(--font-mono);
  overflow-wrap: anywhere;
}
.map-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  align-items: stretch;
}
.map-model-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.map-catalogue-move {
  transition: transform 220ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .map-catalogue-move {
    transition: none;
  }
}
</style>
