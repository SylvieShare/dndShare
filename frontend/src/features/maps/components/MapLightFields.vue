<template>
  <MapInspectorSection title="Параметры света">
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="`${field.label}: ${displayValue(field)}`"
      vertical
    >
      <AppSlider
        :model-value="displayValue(field)"
        :min="
          field.key === 'height'
            ? Math.max(0, -lightSourceOffset(light))
            : field.min
        "
        :max="
          field.key === 'height'
            ? Math.min(
                Math.max(field.max, lightBaseHeight(light)),
                (light.builtinKey ? 256 : 16) - lightSourceOffset(light),
              )
            : field.max
        "
        :step="field.step"
        :label="field.label"
        @update:model-value="
          field.key === 'height'
            ? editor.updateLightHeight(light.id, $event)
            : editor.updateLight(light.id, field.key, $event)
        "
        @change="editor.finishLightEdit"
      />
    </FormField>
    <FormField v-if="light.effect" label="Смещение источника света" vertical>
      <AppSlider
        :model-value="lightSourceOffset(light)"
        :min="Math.max(-32, -lightBaseHeight(light))"
        :max="
          Math.min(32, (light.builtinKey ? 256 : 16) - lightBaseHeight(light))
        "
        :step="0.05"
        label="Смещение источника света"
        @update:model-value="editor.updateLightSourceOffset(light.id, $event)"
        @change="editor.finishLightEdit"
      />
    </FormField>
    <MapLightActions :editor="editor" :light="light" />
  </MapInspectorSection>
  <MapLightEffectFields
    :effect="light.effect"
    @update="editor.updateLight(light.id, 'effect', $event)"
    @finish="editor.finishLightEdit"
  />
  <MapInspectorSection title="Привязка">
    <MapEntityRow v-if="anchor" :entry="anchor" @select="emit('focus', $event)">
      <template v-if="!light.builtinKey" #actions>
        <ActionButton
          icon-only
          variant="quiet"
          aria-label="Отвязать источник"
          title="Отвязать источник"
          @click.stop="editor.bindLight(light.id, null)"
          ><template #icon><X :size="18" /></template
        ></ActionButton>
      </template>
    </MapEntityRow>
    <ActionButton
      :disabled="!!light.builtinKey"
      variant="secondary"
      @click="
        editor.bindingLight === light.id
          ? editor.cancelLightBinding()
          : emit('bind', light.id)
      "
    >
      <template #icon
        ><LockKeyhole v-if="light.builtinKey" :size="16" /><Link
          v-else
          :size="16"
      /></template>
      {{
        light.builtinKey
          ? "Привязка к модели фиксирована"
          : editor.bindingLight === light.id
            ? "Отменить привязку"
            : light.anchor
              ? "Изменить привязку"
              : "Привязать"
      }}
    </ActionButton>
    <p v-if="editor.bindingLight === light.id" class="map-hint" role="status">
      Нажмите на плитку или объект на карте.
    </p>
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, AppSlider, FormField } from "@sylvieshare/share-ui";
import { Link, LockKeyhole, X } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import { lightBaseHeight, lightSourceOffset } from "../lib/lightEffect";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapLightEffectFields from "./MapLightEffectFields.vue";
import MapLightActions from "./MapLightActions.vue";
const emit = defineEmits(["bind", "focus"]);
const props = defineProps({ editor: Object, light: Object });
const fields = [
  { key: "intensity", label: "Яркость", min: 0, max: 50, step: 0.5 },
  { key: "radius", label: "Радиус света", min: 0.25, max: 32, step: 0.25 },
  { key: "height", label: "Высота", min: 0, max: 16, step: 0.1 },
];
const displayValue = (field) =>
  field.key === "height"
    ? lightBaseHeight(props.light)
    : props.light[field.key];
const anchor = computed(
  () =>
    props.light.anchor &&
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      props.light.anchor.kind,
      props.light.anchor.id,
    ),
);
</script>
