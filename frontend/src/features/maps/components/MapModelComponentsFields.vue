<template>
  <DetailSection
    :label="`Флаги модели (${behaviour.defaultFlags.length})`"
    collapsible
  >
    <BaseTile
      v-for="flag in behaviour.defaultFlags"
      :key="flag.key"
      class="model-component-fields"
    >
      <FormField label="Название флага" vertical
        ><FormTextInput
          v-model:value="flag.name"
          aria-label="Название флага модели"
          :maxlength="100"
          required
      /></FormField>
      <ToggleSwitch v-model="flag.enabled" label="Включён по умолчанию" />
      <RemoveButton
        icon="trash"
        :label="`Удалить флаг ${flag.name}`"
        @click="removeFlag(flag.key)"
      />
    </BaseTile>
    <ActionButton
      variant="secondary"
      :disabled="behaviour.defaultFlags.length >= 16"
      @click="
        behaviour.defaultFlags.push({
          key: uid().slice(0, 8),
          name: 'Горит',
          enabled: true,
        })
      "
      >Добавить флаг модели</ActionButton
    >
  </DetailSection>
  <DetailSection
    :label="`Эффекты модели (${behaviour.defaultEffects.length})`"
    collapsible
  >
    <BaseTile
      v-for="(effect, index) in behaviour.defaultEffects"
      :key="effect.key"
      class="model-effect-fields"
    >
      <FormField label="Название эффекта" vertical
        ><FormTextInput
          v-model:value="effect.name"
          :aria-label="`Эффект модели ${index + 1}: название`"
          :maxlength="100"
          required
      /></FormField>
      <FormField label="Управляющий флаг" vertical
        ><FormSelect
          v-model:value="effect.flagKey"
          :aria-label="`Эффект модели ${index + 1}: флаг`"
          ><option value="">Без флага</option>
          <option
            v-for="flag in behaviour.defaultFlags"
            :key="flag.key"
            :value="flag.key"
          >
            {{ flag.name }}
          </option></FormSelect
        ></FormField
      >
      <FormField
        v-for="(label, coordinate) in ['X', 'Y', 'Высота основания']"
        :key="label"
        :label="label"
        vertical
        ><FormTextInput
          type="number"
          :value="effect.position[coordinate]"
          :aria-label="`Эффект модели ${index + 1}: ${label}`"
          step="any"
          :min="coordinate === 2 ? 0 : -8"
          :max="coordinate === 2 ? 32 : 8"
          @update:value="effect.position[coordinate] = Number($event)"
      /></FormField>
      <FormField
        v-for="(label, dimension) in ['Ширина', 'Высота пламени']"
        :key="label"
        :label="label"
        vertical
        ><FormTextInput
          type="number"
          :value="effect.size[dimension]"
          :aria-label="`Эффект модели ${index + 1}: ${label}`"
          :min="0.02"
          :max="dimension === 0 ? 8 : 16"
          step="any"
          @update:value="effect.size[dimension] = Number($event)"
      /></FormField>
      <FormField label="Сила колебаний" vertical
        ><FormTextInput
          type="number"
          :value="effect.strength"
          :aria-label="`Эффект модели ${index + 1}: сила колебаний`"
          :min="0"
          :max="2"
          step="0.05"
          @update:value="effect.strength = Number($event)"
      /></FormField>
      <ColorPresetPicker
        v-model="effect.color"
        allow-custom
        :aria-label="`Эффект модели ${index + 1}: цвет`"
      />
      <ToggleSwitch v-model="effect.enabled" label="Включён по умолчанию" />
      <RemoveButton
        icon="trash"
        :label="`Удалить эффект ${effect.name}`"
        @click="behaviour.defaultEffects.splice(index, 1)"
      />
    </BaseTile>
    <ActionButton
      variant="secondary"
      :disabled="behaviour.defaultEffects.length >= 16"
      @click="addEffect"
      >Добавить огонь модели</ActionButton
    >
  </DetailSection>
</template>
<script setup>
import {
  ActionButton,
  BaseTile,
  ColorPresetPicker,
  DetailSection,
  FormField,
  FormSelect,
  FormTextInput,
  RemoveButton,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { uid } from "../lib/mapModel";
const props = defineProps({ model: Object, behaviour: Object });
function removeFlag(key) {
  props.behaviour.defaultFlags = props.behaviour.defaultFlags.filter(
    (f) => f.key !== key,
  );
  for (const item of [
    ...props.behaviour.defaultLights,
    ...props.behaviour.defaultEffects,
  ])
    if (item.flagKey === key) item.flagKey = "";
}
function addEffect() {
  props.behaviour.defaultEffects.push({
    key: uid().slice(0, 8),
    name: "Огонь",
    kind: "fire",
    color: "#ffb04a",
    size: [0.3, 0.5],
    strength: 0.7,
    enabled: true,
    flagKey: props.behaviour.defaultFlags[0]?.key || "",
    position: [
      props.model.width / 2,
      props.model.height / 2,
      Math.max(0, props.model.surfaceHeight - props.model.mountDepth),
    ],
  });
}
</script>
<style scoped>
.model-component-fields,
.model-effect-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  margin-bottom: 10px;
}
@media (max-width: 760px) {
  .model-component-fields,
  .model-effect-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
