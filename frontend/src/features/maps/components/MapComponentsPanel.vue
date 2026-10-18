<template>
  <div class="map-components-panel">
    <ActionButton
      v-if="kind === 'flag'"
      variant="secondary"
      :disabled="manualCount >= 128"
      @click="editor.addFlag"
    >
      <template #icon><Plus :size="18" /></template>Добавить флаг
    </ActionButton>
    <ActionButton
      v-else
      variant="secondary"
      :disabled="manualCount >= 128"
      @click="emit('place-effect', 'fire', $event)"
    >
      <template #icon><Flame :size="18" /></template>Добавить огонь
    </ActionButton>
    <p class="map-hint">
      {{
        kind === "flag"
          ? "Флаг включает связанные источники света и эффекты."
          : "Выберите огонь, затем нажмите на поверхность карты."
      }}
    </p>
    <MapEntityRow
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
      :toggle-flag="kind === 'flag'"
      :selected="
        (kind === 'flag' ? editor.selectedFlag : editor.selectedEffect) ===
        entry.id
      "
      @select="editor.selectComponent(kind, entry.id)"
      @toggle="editor.updateFlag(entry.id, 'enabled', !entry.item.enabled)"
    />
  </div>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Flame, Plus } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object, kind: String });
const emit = defineEmits(["place-effect"]);
const items = computed(
  () =>
    props.editor.draft.document[props.kind === "flag" ? "flags" : "effects"] ||
    [],
);
const entries = computed(() =>
  items.value.map((x) =>
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      props.kind,
      x.id,
    ),
  ),
);
const manualCount = computed(
  () => items.value.filter((x) => !x.builtinKey).length,
);
</script>
<style scoped>
.map-components-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
