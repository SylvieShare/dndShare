<template>
  <MapFocusContent>
    <template #heading
      ><MapEntityHeading
        :entry="entry"
        editable
        @rename="editor.updateFlag(entry.id, 'name', $event)"
    /></template>
    <ToggleSwitch
      :model-value="entry.item.enabled"
      label="Включён"
      @update:model-value="editor.updateFlag(entry.id, 'enabled', $event)"
    />
    <MapInspectorSection :title="`Зависимости (${dependencies.length})`">
      <MapEntityRow
        v-for="dependency in dependencies"
        :key="`${dependency.kind}:${dependency.id}`"
        :entry="dependency"
        @select="emit('focus', [$event])"
      >
        <template #details
          ><small>{{
            dependency.kind === "light" ? "Освещение" : "Эффект огня"
          }}</small></template
        >
        <template #actions
          ><ActionButton
            icon-only
            variant="quiet"
            :aria-label="`Отвязать ${dependency.name} от флага`"
            @click.stop="bind(dependency, '')"
            ><template #icon><Minus :size="16" /></template></ActionButton
        ></template>
      </MapEntityRow>
      <p v-if="!dependencies.length" class="map-hint">
        Зависимостей пока нет. Добавьте свет или эффект.
      </p>
      <FormSelect
        v-model:value="candidate"
        aria-label="Добавить зависимость флага"
      >
        <option value="">Выберите элемент</option>
        <option
          v-for="option in available"
          :key="option.value"
          :value="option.value"
        >
          {{ option.entry.name }} ·
          {{ option.entry.kind === "light" ? "свет" : "эффект" }}
        </option>
      </FormSelect>
      <ActionButton variant="secondary" :disabled="!candidate" @click="add"
        >Привязать элемент</ActionButton
      >
    </MapInspectorSection>
    <MapInspectorSection v-if="owner" title="Принадлежит модели"
      ><MapEntityRow :entry="owner" @select="emit('focus', [$event])"
    /></MapInspectorSection>
    <ActionButton
      v-if="!entry.item.builtinKey"
      variant="secondary"
      @click="editor.removeComponent('flag', entry.id)"
      >Удалить флаг</ActionButton
    >
  </MapFocusContent>
</template>
<script setup>
import { computed, ref } from "vue";
import { ActionButton, FormSelect, ToggleSwitch } from "@sylvieshare/share-ui";
import { Minus } from "@lucide/vue";
import { flagDependencies, mapEntity } from "../lib/editorEntities";
import MapEntityHeading from "./MapEntityHeading.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapFocusContent from "./MapFocusContent.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, entry: Object });
const emit = defineEmits(["focus"]),
  candidate = ref("");
const dependencies = computed(() =>
  flagDependencies(props.editor, props.entry.id),
);
const available = computed(() =>
  ["light", "effect"].flatMap((kind) =>
    (props.editor.draft.document[kind === "light" ? "lights" : "effects"] || [])
      .filter((x) => x.flagId !== props.entry.id)
      .map((x) => ({
        value: `${kind}:${x.id}`,
        entry: mapEntity(
          props.editor.draft.document,
          props.editor.catalogue,
          kind,
          x.id,
        ),
      })),
  ),
);
const owner = computed(
  () =>
    props.entry.item.anchor &&
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      props.entry.item.anchor.kind,
      props.entry.item.anchor.id,
    ),
);
function bind(entry, value) {
  if (entry.kind === "light") {
    props.editor.updateLight(entry.id, "flagId", value);
    props.editor.finishLightEdit();
  } else {
    props.editor.updateEffect(entry.id, "flagId", value);
    props.editor.finishComponentEdit();
  }
}
function add() {
  const option = available.value.find((x) => x.value === candidate.value);
  if (option) bind(option.entry, props.entry.id);
  candidate.value = "";
}
</script>
