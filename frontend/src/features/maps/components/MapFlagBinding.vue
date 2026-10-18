<template>
  <MapInspectorSection title="Управляющий флаг">
    <FormSelect
      :value="item.flagId || ''"
      aria-label="Управляющий флаг"
      @update:value="assign"
    >
      <option value="">Без флага</option>
      <option v-for="entry in flags" :key="entry.id" :value="entry.id">
        {{ entry.name }}
      </option>
    </FormSelect>
    <MapEntityRow
      v-if="selected"
      :entry="selected"
      @select="emit('focus', [$event])"
    />
    <p v-if="selected && !selected.enabled" class="map-hint">
      Флаг выключен. Элемент начнёт работать после его включения.
    </p>
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import { FormSelect } from "@sylvieshare/share-ui";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, kind: String, item: Object });
const emit = defineEmits(["focus"]);
const flags = computed(() =>
  (props.editor.draft.document.flags || []).map((f) =>
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      "flag",
      f.id,
    ),
  ),
);
const selected = computed(() =>
  flags.value.find((f) => f.id === props.item.flagId),
);
function assign(value) {
  if (props.kind === "light") {
    props.editor.updateLight(props.item.id, "flagId", value);
    props.editor.finishLightEdit();
  } else {
    props.editor.updateEffect(props.item.id, "flagId", value);
    props.editor.finishComponentEdit();
  }
}
</script>
