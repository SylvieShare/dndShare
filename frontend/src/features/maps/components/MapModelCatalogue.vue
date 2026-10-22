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
        v-for="subsection in section.subsections"
        :key="subsection.key"
        class="map-model-subsection"
      >
        <h5 v-if="subsection.name">{{ subsection.name }}</h5>
        <TransitionGroup
          name="map-card"
          tag="div"
          class="map-model-grid"
          :class="{ 'map-model-grid--compact': compact }"
        >
          <MapCatalogueCard
            v-for="model in subsection.models"
            :key="model.id"
            :item="model"
            :selected="selectedId === model.id"
            :show-identifiers="showIdentifiers"
            :draggable="draggable"
            @select="(id, event) => emit('model', id, event)"
            @drag="(id, event) => emit('drag-tile', id, event)"
          />
        </TransitionGroup>
      </div>
    </section>
  </TransitionGroup>
</template>
<script setup>
import { computed } from "vue";
import { modelGroups } from "../lib/modelGroups";
import MapCatalogueCard from "./MapCatalogueCard.vue";
const props = defineProps({
  models: Array,
  groups: Array,
  wallSubcategories: Boolean,
  selectedId: String,
  compact: Boolean,
  draggable: Boolean,
  showIdentifiers: Boolean,
});
const emit = defineEmits(["model", "drag-tile"]);
const sections = computed(
  () =>
    props.groups ||
    modelGroups(props.models || [], {
      wallSubcategories: props.wallSubcategories,
    }),
);
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
h5 {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.map-model-subsection + .map-model-subsection {
  margin-top: 16px;
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
.map-card-enter-active,
.map-card-leave-active {
  transition: opacity 180ms ease;
}
.map-card-enter-from,
.map-card-leave-to {
  opacity: 0;
}
.map-catalogue-move {
  transition: transform 220ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .map-catalogue-move,
  .map-card-enter-active,
  .map-card-leave-active {
    transition: none;
  }
}
</style>
