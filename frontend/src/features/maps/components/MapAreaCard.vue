<template>
  <BaseTile class="map-area-card">
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
    <span class="map-hint"
      >Тайлов: {{ area.tileIds.length }} · Объектов:
      {{ area.objectIds.length }}</span
    >
    <ActionButton
      variant="secondary"
      :disabled="!editor.areaSelectionCount"
      @click="editor.addSelectionToArea(area.id)"
      >Добавить выбранное ({{ editor.areaSelectionCount }})</ActionButton
    >
    <ActionButton
      variant="quiet"
      :disabled="!editor.areaSelectionCount"
      @click="editor.removeSelectionFromArea(area.id)"
      >Убрать выбранное из области</ActionButton
    >
    <DetailSection
      v-if="members.length"
      label="Состав области"
      collapsible
      :default-open="false"
    >
      <div
        v-for="member in members"
        :key="member.kind + member.id"
        class="map-area-member"
      >
        <span>{{ member.label }}</span>
        <RemoveButton
          icon="trash"
          :label="`Убрать ${member.label} из области «${area.name}»`"
          @click="editor.removeAreaMember(area.id, member.kind, member.id)"
        />
      </div>
    </DetailSection>
    <RemoveButton
      icon="trash"
      :label="`Удалить область «${area.name}»`"
      @click="editor.removeArea(area.id)"
    />
  </BaseTile>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import {
  ActionButton,
  BaseTile,
  DetailSection,
  FormField,
  FormTextInput,
  RemoveButton,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
const props = defineProps({ area: Object, index: Number, editor: Object });
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
const members = computed(() => {
  const d = props.editor.draft.document,
    models = new Map(props.editor.catalogue.map((m) => [m.id, m]));
  return [
    ...d.tiles
      .filter((t) => props.area.tileIds.includes(t.id))
      .map((t) => ({
        id: t.id,
        kind: "tileIds",
        label: `${models.get(t.modelId)?.name || "Тайл"} (${t.x}, ${t.y})`,
      })),
    ...d.objects
      .filter((o) => props.area.objectIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        kind: "objectIds",
        label: models.get(o.modelId)?.name || "Объект",
      })),
  ];
});
</script>
<style scoped>
.map-area-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
.map-area-member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}
</style>
