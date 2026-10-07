<template>
  <BaseTile ref="card" class="map-area-card" :framed="focus">
    <FormField label="Название области" vertical>
      <FormTextInput
        v-model:value="name"
        :aria-label="`Название области ${index + 1}`"
        :maxlength="100"
        required
        @change="rename"
        @enter="rename"
      />
    </FormField>
    <ToggleSwitch
      :model-value="area.hidden"
      :label="`Скрыть область «${area.name}»`"
      @update:model-value="editor.setAreaHidden(area.id, $event)"
    />
    <ActionButton
      variant="secondary"
      :disabled="!area.tileIds.length && !area.objectIds.length"
      @click="editor.selectArea(area.id)"
      >Выбрать все объекты в области</ActionButton
    >
    <ActionButton
      variant="secondary"
      :disabled="!counts.add"
      @click="editor.addSelectionToArea(area.id)"
      >Добавить выбранное ({{ counts.add }})</ActionButton
    >
    <ActionButton
      variant="quiet"
      :disabled="!counts.remove"
      @click="editor.removeSelectionFromArea(area.id)"
      >Убрать выбранное из области ({{ counts.remove }})</ActionButton
    >
    <RemoveButton
      icon="trash"
      :label="`Удалить область «${area.name}»`"
      @click="editor.removeArea(area.id)"
    />
  </BaseTile>
</template>
<script setup>
import { computed, nextTick, ref, watch } from "vue";
import {
  ActionButton,
  BaseTile,
  FormField,
  FormTextInput,
  RemoveButton,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
const props = defineProps({
  area: Object,
  index: Number,
  editor: Object,
  focus: Boolean,
});
const card = ref(null);
watch(
  () => props.focus,
  async (value) => {
    if (!value) return;
    await nextTick();
    const element = card.value?.$el;
    element?.scrollIntoView({ block: "nearest" });
    element?.querySelector("input")?.focus({ preventScroll: true });
  },
  { immediate: true },
);
const name = ref(props.area.name);
watch(
  () => props.area.name,
  (value) => {
    name.value = value;
  },
);
function rename() {
  props.editor.renameArea(props.area.id, name.value);
  name.value = props.area.name;
}
const counts = computed(() => props.editor.areaSelectionCounts(props.area.id));
</script>
<style scoped>
.map-area-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
</style>
