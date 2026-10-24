<template>
  <MapSelectedEntity
    :key="`${entry.kind}:${entry.id}`"
    :entry="entry"
    :editor="actions"
    :copyable="false"
    :removable="!!token"
  >
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
      <p v-if="tokens.error" class="map-error" role="status">{{ tokens.error }}</p>
      <ActionButton v-if="!token" @click="tokens.place(candidate)"
        >Поставить на карту</ActionButton
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
            :key="sizeReset"
            :value="token.size"
            @change="resize"
            ><option
              v-for="size in [0.5, 1, 2, 3, 4, 6, 8]"
              :key="size"
              :value="size"
            >
              {{ size }} × {{ size }}
            </option></FormSelect
          ></FormField
        >
        <small v-if="candidate.kind === 'creature'" class="map-hint">
          По справочнику: {{ candidate.size || 1 }} × {{ candidate.size || 1 }}
        </small>
        <ActionButton v-if="candidate.kind === 'creature' && token.size !== (candidate.size || 1)" variant="quiet" @click="tokens.change(t => { t.size = candidate.size || 1 })">Размер из справочника</ActionButton>
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
  </MapSelectedEntity>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ActionButton,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
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
const sizeReset = ref(0);
function resize(value) {
  if (!props.tokens.change(t => { t.size = Number(value); })) sizeReset.value++;
}
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
