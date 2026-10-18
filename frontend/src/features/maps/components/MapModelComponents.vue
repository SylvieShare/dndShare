<template>
  <MapInspectorSection v-if="entries.length" title="Флаги и эффекты модели">
    <MapEntityRow
      v-for="item in entries"
      :key="`${item.kind}:${item.id}`"
      :entry="item"
      :toggle-flag="item.kind === 'flag'"
      @select="emit('focus', [$event])"
      @toggle="editor.updateFlag(item.id, 'enabled', !item.item.enabled)"
    />
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, entry: Object });
const emit = defineEmits(["focus"]);
const entries = computed(() =>
  ["flag", "effect"].flatMap((kind) =>
    (props.editor.draft.document[kind === "flag" ? "flags" : "effects"] || [])
      .filter(
        (x) =>
          x.anchor?.kind === props.entry.kind && x.anchor.id === props.entry.id,
      )
      .map((x) =>
        mapEntity(
          props.editor.draft.document,
          props.editor.catalogue,
          kind,
          x.id,
        ),
      ),
  ),
);
</script>
