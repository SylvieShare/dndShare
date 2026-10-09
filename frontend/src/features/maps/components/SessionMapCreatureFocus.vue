<template>
  <MapSelectedEntity
    :entry="entry"
    :editor="actions"
    :copyable="false"
    :removable="!!token"
    :rotatable="false"
    :position-visible="!!token"
  />
  <MapInspectorSection title="Здоровье">
    <SessionHpBar v-if="candidate.hp" :hp="candidate.hp" size="medium" />
    <span v-else class="map-hint">Хиты не указаны</span>
    <span v-if="candidate.ac != null" class="map-hint"
      >Класс доспеха: {{ candidate.ac }}</span
    >
    <ActionButton
      v-if="candidate.combatant && encounter?.openHpCalc"
      variant="quiet"
      @click="encounter.openHpCalc(candidate.combatant)"
      >Калькулятор HP</ActionButton
    >
    <ActionButton
      v-if="candidate.participant"
      variant="quiet"
      @click="emit('participant', candidate.participant)"
      >Открыть лист</ActionButton
    >
  </MapInspectorSection>
  <MapInspectorSection title="Размещение">
    <ActionButton v-if="!token" @click="tokens.place(candidate)"
      ><template #icon><Plus :size="18" /></template>Поставить на
      карту</ActionButton
    >
    <template v-else>
      <FormTextInput
        v-if="token.kind === 'marker'"
        :value="token.name"
        aria-label="Название метки"
        :maxlength="100"
        @change="
          tokens.change((t) => {
            t.name = $event;
          })
        "
      />
      <FormField label="Размер, клеток"
        ><FormSelect
          :value="token.size"
          @change="
            tokens.change((t) => {
              t.size = Number($event);
            })
          "
          ><option
            v-for="size in [0.5, 1, 2, 3, 4, 6, 8]"
            :key="size"
            :value="size"
          >
            {{ size }} × {{ size }}
          </option></FormSelect
        ></FormField
      >
      <ToggleSwitch
        :model-value="token.hidden"
        label="Скрыть от игроков"
        @update:model-value="
          tokens.change((t) => {
            t.hidden = $event;
          })
        "
      />
      <ToggleSwitch
        :model-value="token.physical"
        label="Физическая миниатюра"
        @update:model-value="
          tokens.change((t) => {
            t.physical = $event;
          })
        "
      />
    </template>
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { Plus } from "@lucide/vue";
import SessionHpBar from "@/features/sessions/components/SessionHpBar.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
const props = defineProps({
  editor: Object,
  tokens: Object,
  candidate: Object,
  token: Object,
  encounter: Object,
});
const emit = defineEmits(["participant"]);
const entry = computed(() => ({
  ...props.candidate,
  item: props.token || {},
  position: props.token
    ? resolvedSurfacePosition(
        props.token,
        props.editor.draft.document,
        props.editor.catalogue,
      )
    : {},
  previewUrl: props.candidate.previewUrl || props.token?.imageUrl,
}));
const actions = { removeSelected: () => props.tokens.remove() };
</script>
