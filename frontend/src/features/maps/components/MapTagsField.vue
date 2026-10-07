<template>
  <FormField label="Теги" vertical>
    <SearchMultiSelect
      :model-value="editor.draft.document.tags"
      :options="options"
      :limit="MAX_MAP_TAGS"
      label="Теги карты"
      placeholder="Выбрать или добавить тег…"
      empty-label="Тег не найден"
      remove-label="Убрать тег"
      create-label="Добавить тег"
      allow-create
      :z-index="3400"
      @update:model-value="update"
      @create="update([...editor.draft.document.tags, $event])"
    />
    <p v-if="error" class="map-error" role="alert">{{ error }}</p>
  </FormField>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import { FormField, SearchMultiSelect } from "@sylvieshare/share-ui";
import { getMaps } from "@/shared/api/mapsApi";
import {
  availableMapTags,
  normalizedMapTags,
  MAX_MAP_TAGS,
} from "../lib/mapTags";
const props = defineProps({ editor: Object });
const known = ref([]),
  error = ref("");
const options = computed(() =>
  availableMapTags([
    {
      document: { tags: [...props.editor.draft.document.tags, ...known.value] },
    },
  ]).map((tag) => ({ value: tag, label: tag })),
);
function update(values) {
  try {
    const tags = normalizedMapTags(values);
    error.value = "";
    props.editor.change((m) => {
      m.document.tags = tags;
    });
  } catch (cause) {
    error.value = cause.message;
  }
}
onMounted(async () => {
  try {
    known.value = availableMapTags(await getMaps());
  } catch {
    /* New tags remain available when suggestions cannot be loaded. */
  }
});
</script>
