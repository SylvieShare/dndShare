<template>
  <section class="map-properties" aria-label="Свойства карты">
    <div class="map-last-save" role="status" aria-label="Последнее сохранение">
      <strong>Последнее сохранение</strong>
      <time v-if="editor.lastSavedAt" :datetime="editor.lastSavedAt">{{
        savedTime
      }}</time>
      <span v-else>Ещё не сохранялась</span>
    </div>
    <ToggleSwitch
      label="Показывать точки в пазах"
      :model-value="editor.showAnchors"
      @update:model-value="editor.showAnchors = $event"
    />
    <FormField label="Название" vertical
      ><FormTextInput
        :value="editor.draft.name"
        aria-label="Название карты"
        :maxlength="160"
        @change="
          editor.change((m) => {
            m.name = $event;
          })
        "
    /></FormField>
    <MapTagsField :editor="editor" />
    <FormField label="Ширина" hint="клеток"
      ><FormNumberInput
        :value="d.width"
        role="group"
        aria-label="Ширина карты"
        :min="2"
        :max="Math.min(160, Math.floor(16000 / d.height))"
        @change="resize($event, d.height)"
    /></FormField>
    <FormField label="Высота" hint="клеток"
      ><FormNumberInput
        :value="d.height"
        role="group"
        aria-label="Высота карты"
        :min="2"
        :max="Math.min(160, Math.floor(16000 / d.width))"
        @change="resize(d.width, $event)"
    /></FormField>
    <ToggleSwitch
      :model-value="d.grid.visible"
      label="Показывать сетку"
      @update:model-value="
        editor.change(() => {
          d.grid.visible = $event;
        })
      "
    />
    <ConfirmDialog
      v-if="pendingSize"
      title="Уменьшить карту?"
      message="Клетки и объекты за новой границей будут удалены. Действие можно отменить в редакторе."
      confirm-label="Изменить размер"
      :z-index="3200"
      @confirm="
        editor.resize(...pendingSize);
        pendingSize = null;
      "
      @cancel="pendingSize = null"
    />
  </section>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ConfirmDialog,
  FormField,
  FormNumberInput,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import MapTagsField from "./MapTagsField.vue";
const props = defineProps({ editor: { type: Object, required: true } });
const savedTime = computed(
  () =>
    props.editor.lastSavedAt &&
    new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(props.editor.lastSavedAt)),
);
const d = computed(() => props.editor.draft.document),
  pendingSize = ref(null);
function resize(w, h) {
  if (w < d.value.width || h < d.value.height) pendingSize.value = [w, h];
  else props.editor.resize(w, h);
}
</script>

<style scoped>
.map-last-save {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.map-last-save time,
.map-last-save span {
  color: var(--text-muted);
}
</style>
