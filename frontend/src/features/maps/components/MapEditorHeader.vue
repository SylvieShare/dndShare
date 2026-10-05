<template>
  <WorkspaceHeader class="map-workspace-header">
    <template #identity>
      <ActionButton
        variant="quiet"
        aria-label="Закрыть редактор"
        @click="emit('close')"
        ><ArrowLeft :size="18" />Карты</ActionButton
      >
      <div class="map-editor-heading">
        <h1>Редактор карты</h1>
        <span>{{ editor.draft.name }}</span>
      </div>
    </template>
    <template #navigation>
      <SlidingTabs
        :model-value="view"
        :tabs="[
          { key: 'map', title: 'Карта' },
          { key: 'items', title: 'Предметы' },
          { key: 'settings', title: 'Настройки' },
        ]"
        aria-label="Режим редактора"
        @update:model-value="emit('view', $event)"
      />
    </template>
    <template #actions>
      <div class="map-global-collection">
        <FormSelect
          :value="editor.collection"
          aria-label="Коллекция плиток"
          @change="emit('collection', $event)"
          ><option
            v-for="collection in collections"
            :key="collection.id"
            :value="collection.id"
          >
            {{ collection.name }}
          </option></FormSelect
        >
      </div>
      <span class="map-save-status" role="status">{{
        editor.saving
          ? "Сохраняем…"
          : editor.dirty
            ? "Есть изменения"
            : "Сохранено"
      }}</span>
      <ActionButton
        :disabled="!editor.dirty || editor.conflict"
        :loading="editor.saving"
        aria-label="Сохранить"
        @click="editor.save"
        ><Save :size="16" /><span class="map-save-label"
          >Сохранить</span
        ></ActionButton
      >
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton, FormSelect, SlidingTabs } from "@sylvieshare/share-ui";
import { computed } from "vue";
import { ArrowLeft, Save } from "@lucide/vue";
import WorkspaceHeader from "@/shared/ui/WorkspaceHeader.vue";
const props = defineProps({ editor: Object, view: String });
const emit = defineEmits(["close", "view", "collection"]);
const collections = computed(() => [
  ...new Map(
    props.editor.catalogue.map((m) => [
      m.collection,
      { id: m.collection, name: m.collectionName || m.collection },
    ]),
  ).values(),
]);
</script>
<style scoped>
.map-global-collection {
  width: 180px;
  max-width: 28vw;
}
@media (max-width: 760px) {
  .map-global-collection {
    width: 135px;
    max-width: 34vw;
  }
  .map-save-status,
  .map-save-label {
    display: none;
  }
}
</style>
