<template>
  <DetailSection
    :label="`Переходы (${behaviour.transitions.length})`"
    collapsible
  >
    <BaseTile
      v-for="(transition, index) in behaviour.transitions"
      :key="transition.id"
      class="model-transition-fields"
    >
      <FormField label="Действие" vertical
        ><FormSelect
          v-model:value="transition.action"
          :aria-label="`Переход ${index + 1}: действие`"
        >
          <option
            v-for="action in TRANSITION_ACTIONS"
            :key="action.value"
            :value="action.value"
          >
            {{ action.label }}
          </option>
        </FormSelect></FormField
      >
      <FormField label="Целевая модель" vertical
        ><FormSelect
          v-model:value="transition.toDefinitionId"
          :aria-label="`Переход ${index + 1}: модель`"
          required
        >
          <option value="" disabled>Выберите модель</option>
          <option
            v-for="target in targets"
            :key="target.definitionId"
            :value="target.definitionId"
          >
            {{ target.collectionName }} · {{ target.sourceCode }} ·
            {{ target.name }}
          </option>
        </FormSelect></FormField
      >
      <RemoveButton
        icon="trash"
        :label="`Удалить переход ${index + 1}`"
        @click="behaviour.transitions.splice(index, 1)"
      />
    </BaseTile>
    <ActionButton
      variant="secondary"
      :disabled="behaviour.transitions.length >= 32 || !targets.length"
      @click="addTransition"
      >Добавить переход</ActionButton
    >
  </DetailSection>
  <DetailSection
    :label="`Встроенный свет (${behaviour.defaultLights.length})`"
    collapsible
  >
    <p class="map-hint">
      X и Y — внутри площади модели. Высота — над основанием без монтажного
      выступа. Изменения применяются ко всем версиям этой модели.
    </p>
    <MapModelLightTemplate
      v-for="(light, index) in behaviour.defaultLights"
      :key="light.key"
      :light="light"
      :index="index"
      @remove="behaviour.defaultLights.splice(index, 1)"
    />
    <ActionButton
      variant="secondary"
      :disabled="behaviour.defaultLights.length >= 8"
      @click="addLight"
      >Добавить встроенный источник</ActionButton
    >
  </DetailSection>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  BaseTile,
  DetailSection,
  FormField,
  FormSelect,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { latestModelVersions } from "../lib/modelVersions";
import { TRANSITION_ACTIONS } from "../lib/modelTransitions";
import { uid } from "../lib/mapModel";
import MapModelLightTemplate from "./MapModelLightTemplate.vue";
const props = defineProps({
  model: Object,
  behaviour: Object,
  catalogue: Array,
});
const targets = computed(() =>
  latestModelVersions(props.catalogue)
    .filter(
      (m) =>
        m.definitionId &&
        m.definitionId !== props.model.definitionId &&
        (m.tileType === "object") === (props.model.tileType === "object"),
    )
    .sort(
      (a, b) =>
        a.collection.localeCompare(b.collection) ||
        a.sourceCode.localeCompare(b.sourceCode),
    ),
);
function addTransition() {
  props.behaviour.transitions.push({
    id: uid(),
    action: "open",
    toDefinitionId: targets.value[0]?.definitionId || "",
  });
}
function addLight() {
  props.behaviour.defaultLights.push({
    key: uid().slice(0, 8),
    name: "Свет",
    kind: "torch",
    color: "#ffc36a",
    position: [
      props.model.width / 2,
      props.model.height / 2,
      Math.max(0, props.model.maxHeight - props.model.mountDepth) + 0.1,
    ],
    intensity: 8,
    radius: 4.5,
    enabled: true,
    flicker: true,
  });
}
</script>
<style scoped>
.model-transition-fields {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  margin-bottom: 10px;
}
@media (max-width: 760px) {
  .model-transition-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
