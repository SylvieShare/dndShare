<template>
  <FormField label="Название" vertical>
    <span v-if="anchor && !light.builtinKey" class="map-light-name-prefix">{{
      anchor.name
    }}</span>
    <FormTextInput
      :value="
        light.builtinKey && anchor
          ? `${anchor.name} · ${light.name}`
          : light.name
      "
      :disabled="!!light.builtinKey"
      aria-label="Название источника света"
      :maxlength="100"
      @change="
        editor.updateLight(light.id, 'name', $event.trim() || light.name)
      "
    />
  </FormField>
  <MapInspectorSection title="Параметры света">
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="`${field.label}: ${light[field.key]}`"
      vertical
    >
      <AppSlider
        :model-value="light[field.key]"
        :min="field.min"
        :max="
          field.key === 'height' ? Math.max(field.max, light.height) : field.max
        "
        :step="field.step"
        :label="field.label"
        @update:model-value="editor.updateLight(light.id, field.key, $event)"
        @change="editor.finishLightEdit"
      />
    </FormField>
    <MapLightActions :editor="editor" :light="light" />
  </MapInspectorSection>
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
import {
  ActionButton,
  AppSlider,
  FormField,
  FormTextInput,
} from "@sylvieshare/share-ui";
import { Link, LockKeyhole, X } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapLightActions from "./MapLightActions.vue";
const emit = defineEmits(["bind", "focus"]);
const props = defineProps({ editor: Object, light: Object });
const fields = [
  { key: "intensity", label: "Яркость", min: 0, max: 50, step: 0.5 },
  { key: "radius", label: "Радиус света", min: 0.25, max: 32, step: 0.25 },
  { key: "height", label: "Высота источника", min: 0, max: 16, step: 0.1 },
];
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
<style scoped>
.map-light-name-prefix {
  font-size: 12px;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
</style>
