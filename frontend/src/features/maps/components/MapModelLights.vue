<template>
  <section
    v-if="lights.length"
    class="model-lights"
    aria-label="Освещение выбранной модели"
  >
    <template v-for="group in groups" :key="group.title">
      <h4 v-if="group.entries.length">{{ group.title }}</h4>
      <MapEntityRow
        v-for="light in group.entries"
        :key="light.id"
        :entry="light"
        toggle-light
        @toggle="editor.toggleLight"
        @select="editor.selectLight(light.id)"
      >
        <template v-if="!light.item.builtinKey" #actions>
          <ActionButton
            variant="quiet"
            :aria-label="`Отвязать ${light.name}`"
            @click.stop="editor.bindLight(light.id, null)"
            >Отвязать</ActionButton
          >
        </template>
      </MapEntityRow>
    </template>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object, entry: Object });
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
    entries: lights.value.filter((l) => l.item.builtinKey),
  },
  {
    title: "Прикреплённый свет",
    entries: lights.value.filter((l) => !l.item.builtinKey),
  },
]);
</script>
<style scoped>
.model-lights {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h4 {
  margin: 0;
  font-size: 14px;
}
</style>
