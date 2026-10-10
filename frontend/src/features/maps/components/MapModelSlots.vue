<template>
  <DetailSection
    :label="`Опорные пазы (${model.supportSlots.length})`"
    collapsible
  >
    <p class="map-hint">
      Координаты пазов задаются внутри площади тайла. Высота — от нижней точки
      модели.
    </p>
    <BaseTile
      v-for="(slot, index) in model.supportSlots"
      :key="index"
      class="map-model-slot"
      :framed="selectedSlot === index"
      :tint="selectedSlot === index"
      @focusin="emit('select', index)"
      @click="emit('select', index)"
    >
      <strong>Паз {{ index + 1 }}</strong>
      <FormField
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        vertical
      >
        <FormTextInput
          type="number"
          :value="slot[field.key]"
          :aria-label="`Паз ${index + 1}: ${field.label}`"
          :min="field.min"
          :step="field.key === 'elevation' ? 'any' : 1"
          required
          @update:value="slot[field.key] = Number($event)"
        />
      </FormField>
      <template v-if="model.tileType === 'frame'">
        <FormField v-for="profile in Object.keys(slot.insertionRises || {})" :key="profile" :label="`Подъём: ${profile}`" vertical>
          <FormTextInput type="number" :value="slot.insertionRises[profile]" min="0" max="0.1" step="any"
            :aria-label="`Паз ${index + 1}: Подъём ${profile}`"
            @update:value="slot.insertionRises[profile] = Number($event)" />
          <RemoveButton icon="trash" :label="`Удалить профиль ${profile}`" @click="delete slot.insertionRises[profile]" />
        </FormField>
        <FormField label="Новый профиль выступа" vertical>
          <FormTextInput v-model:value="newProfiles[index]" :aria-label="`Паз ${index + 1}: Новый профиль выступа`" maxlength="64" />
          <ActionButton variant="secondary" :disabled="!validProfile(newProfiles[index]) || Object.keys(slot.insertionRises || {}).length >= 16" @click="addProfile(slot, index)">Добавить профиль</ActionButton>
        </FormField>
      </template>
      <FormField
        v-if="model.tileType === 'frame'"
        label="Подъём при вставке"
        vertical
      >
        <FormTextInput
          type="number"
          :value="slot.insertionRise || 0"
          min="0"
          max="0.1"
          step="any"
          :aria-label="`Паз ${index + 1}: Подъём при вставке`"
          @update:value="slot.insertionRise = Number($event)"
        />
      </FormField>
      <RemoveButton
        icon="trash"
        :label="`Удалить паз ${index + 1}`"
        @click="model.supportSlots.splice(index, 1)"
      />
    </BaseTile>
    <ActionButton
      variant="secondary"
      :disabled="model.supportSlots.length >= 64"
      @click="add"
      ><Plus :size="16" />Добавить паз</ActionButton
    >
  </DetailSection>
</template>
<script setup>
import {
  ActionButton,
  BaseTile,
  DetailSection,
  FormField,
  FormTextInput,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { Plus } from "@lucide/vue";
import { reactive } from "vue";
const props = defineProps({ model: Object, selectedSlot: Number });
const emit = defineEmits(["select"]);
const newProfiles = reactive({});
const validProfile = (value) => /^[a-z][a-z0-9-]{0,63}$/.test(value || "");
function addProfile(slot, index) {
  const profile = newProfiles[index];
  if (!validProfile(profile)) return;
  slot.insertionRises ||= {};
  slot.insertionRises[profile] ??= slot.insertionRise || 0;
  newProfiles[index] = "";
}
function add() {
  props.model.supportSlots.push({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: props.model.maxHeight,
  });
  emit("select", props.model.supportSlots.length - 1);
}
const fields = [
  { key: "x", label: "X", min: 0 },
  { key: "y", label: "Z", min: 0 },
  { key: "width", label: "Ширина", min: 1 },
  { key: "height", label: "Длина", min: 1 },
  { key: "elevation", label: "Высота", min: 0 },
];
</script>
<style scoped>
.map-model-slot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
  margin: 12px 0;
  padding: 12px;
}
.map-model-slot strong {
  grid-column: 1/-1;
  font-size: 12px;
}
@media (max-width: 760px) {
  .map-model-slot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
