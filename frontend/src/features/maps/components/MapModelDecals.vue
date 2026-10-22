<template>
  <MapInspectorSection v-if="entries.length || leaving.size" title="Декали">
    <TransitionGroup
      name="model-decal"
      tag="div"
      class="model-decals"
      @after-leave="finished"
      @leave-cancelled="finished"
    >
      <MapEntityRow
        v-for="decal in entries"
        :key="decal.id"
        :data-decal-id="decal.id"
        :entry="decal"
        @select="emit('focus', [decal])"
      >
        <template #actions>
          <ActionButton
            icon-only
            variant="quiet"
            :aria-label="`Удалить декаль «${decal.name}»`"
            :title="`Удалить декаль «${decal.name}»`"
            @click.stop="remove(decal.id)"
            @keydown.stop
          >
            <template #icon><Trash2 :size="18" /></template>
          </ActionButton>
        </template>
      </MapEntityRow>
    </TransitionGroup>
  </MapInspectorSection>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Trash2 } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, entry: Object });
const emit = defineEmits(["focus"]),
  leaving = ref(new Set());
const entries = computed(() =>
  (props.editor.draft.document.decals || [])
    .filter(
      (d) =>
        d.anchor.kind === props.entry.kind && d.anchor.id === props.entry.id,
    )
    .map((d) =>
      mapEntity(
        props.editor.draft.document,
        props.editor.catalogue,
        "decal",
        d.id,
      ),
    ),
);
watch(
  () => props.entry.id,
  () => leaving.value.clear(),
);
function remove(id) {
  leaving.value.add(id);
  props.editor.removeDecal(id);
}
function finished(element) {
  leaving.value.delete(element.dataset.decalId);
}
</script>
<style scoped>
.model-decals {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.model-decal-enter-active,
.model-decal-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.2s ease;
}
.model-decal-enter-from,
.model-decal-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
@media (prefers-reduced-motion: reduce) {
  .model-decal-enter-active,
  .model-decal-leave-active {
    transition: none;
  }
}
</style>
