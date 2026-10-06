<template>
  <section class="map-properties" aria-label="Зоны карты">
    <p class="map-hint">
      Зона может состоять из нескольких областей. В сессии её можно открыть
      целиком.
    </p>
    <ActionButton variant="secondary" @click="editor.addZone"
      ><Plus :size="16" />Новая зона</ActionButton
    >
    <FormSelect
      :value="editor.selectedZone"
      aria-label="Выбранная зона"
      @change="editor.selectedZone = $event"
      ><option value="">Выберите зону</option>
      <option v-for="z in d.zones" :key="z.id" :value="z.id">
        {{ z.name }}
      </option></FormSelect
    >
    <template v-if="zone">
      <FormTextInput
        :value="zone.name"
        aria-label="Название зоны"
        :maxlength="100"
        @change="
          editor.change(() => {
            zone.name = $event;
          })
        "
      />
      <ActionButton
        :variant="editor.tool === 'zone' ? 'primary' : 'secondary'"
        @click="emit('tool', 'zone')"
        ><Square :size="16" />Добавить область</ActionButton
      >
      <ActionButton
        v-if="d.kind !== 'image'"
        :variant="editor.tool === 'zone-brush' ? 'primary' : 'secondary'"
        @click="emit('tool', 'zone-brush')"
        ><Paintbrush :size="16" />Добавить клетки</ActionButton
      >
      <ActionButton
        variant="secondary"
        @click="
          editor.change(() => {
            zone.rects = [];
            zone.cells = [];
          })
        "
        >Очистить разметку</ActionButton
      >
      <ActionButton
        variant="secondary"
        @click="
          editor.change((m) => {
            m.document.zones = m.document.zones.filter((z) => z.id !== zone.id);
          });
          editor.selectedZone = '';
        "
        ><Trash2 :size="16" />Удалить зону</ActionButton
      >
    </template>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, FormSelect, FormTextInput } from "@sylvieshare/share-ui";
import { Paintbrush, Plus, Square, Trash2 } from "@lucide/vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["tool"]);
const d = computed(() => props.editor.draft.document),
  zone = computed(() =>
    d.value.zones.find((z) => z.id === props.editor.selectedZone),
  );
</script>
