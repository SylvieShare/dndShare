<template>
  <section
    v-if="lights.length || leaving.size"
    class="model-lights"
    aria-label="Освещение выбранной модели"
  >
    <template v-for="group in groups" :key="group.title">
      <MapInspectorSection
        v-if="group.entries.length || (group.attached && leaving.size)"
        :title="group.title"
      >
        <TransitionGroup
          name="map-attached-light"
          tag="div"
          class="model-light-list"
          @after-leave="afterLeave"
          @leave-cancelled="afterLeave"
        >
          <div
            v-for="light in group.entries"
            :key="light.id"
            :data-light-id="light.id"
            class="model-light-row"
          >
            <MapEntityRow
              :entry="light"
              toggle-light
              toggle-shadows
              @toggle-shadows="editor.toggleLightShadows"
              @toggle="editor.toggleLight"
              @select="editor.selectLight(light.id)"
              @focus="editor.focusLight(light.id)"
            />
            <ActionButton
              v-if="!light.item.builtinKey"
              icon-only
              variant="quiet"
              :aria-label="`Отвязать ${light.name}`"
              :title="`Отвязать ${light.name}`"
              @click.stop="detach(light.id)"
              ><template #icon><X :size="18" /></template
            ></ActionButton>
          </div>
        </TransitionGroup>
      </MapInspectorSection>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { X } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object, entry: Object });
const leaving = ref(new Set());
watch(
  () => props.entry.id,
  () => leaving.value.clear(),
);
const lights = computed(() =>
  props.editor.draft.document.lights
    .filter(
      (l) =>
        l.anchor?.kind === props.entry.kind && l.anchor.id === props.entry.id,
    )
    .map((l) =>
      mapEntity(
        props.editor.draft.document,
        props.editor.catalogue,
        "light",
        l.id,
      ),
    ),
);
const groups = computed(() => [
  {
    title: "Встроенный свет",
    attached: false,
    entries: lights.value.filter((l) => l.item.builtinKey),
  },
  {
    title: "Прикреплённый свет",
    attached: true,
    entries: lights.value.filter((l) => !l.item.builtinKey),
  },
]);
function detach(id) {
  leaving.value.add(id);
  props.editor.bindLight(id, null);
}
function afterLeave(element) {
  leaving.value.delete(element.dataset.lightId);
}
</script>
<style scoped>
.model-lights {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.model-light-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.model-light-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.model-light-row > :first-child {
  flex: 1;
  min-width: 0;
}
.model-light-list {
  overflow: hidden;
}
.map-attached-light-leave-active {
  transition:
    transform 0.24s ease,
    opacity 0.2s ease;
}
.map-attached-light-leave-to {
  transform: translateX(110%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .map-attached-light-leave-active {
    transition: none;
  }
}
</style>
