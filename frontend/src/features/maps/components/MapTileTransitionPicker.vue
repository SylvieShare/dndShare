<template>
  <AppModalFrame
    title="Выбрать тайл для перехода"
    close-label="Закрыть выбор тайла"
    :width="940"
    @close="emit('close')"
  >
    <MapTilePalette
      :editor="localEditor"
      mode="select"
      :selected-id="selectedId"
      @collection="collection = $event"
      @model="emit('select', $event)"
    />
  </AppModalFrame>
</template>
<script setup>
import { computed, ref } from "vue";
import { AppModalFrame } from "@sylvieshare/share-ui";
import MapTilePalette from "./MapTilePalette.vue";
const props = defineProps({
  editor: Object,
  selectedId: String,
  excluded: Array,
});
const emit = defineEmits(["select", "close"]);
const collection = ref(
  props.editor.catalogue.find((m) => m.id === props.selectedId)?.collection ||
    props.editor.collection,
);
const localEditor = computed(() => ({
  ...props.editor,
  collection: collection.value,
  catalogue: props.editor.catalogue.filter(
    (m) => !props.excluded.includes(m.id),
  ),
}));
</script>
