<template>
  <MapInspectorSection
    v-if="entry.kind === 'tile' || transitions.length"
    title="Переходы"
    aria-label="Переходы модели"
  >
    <TransitionGroup
      name="map-transition"
      tag="div"
      class="map-transition-list"
    >
      <div
        v-for="transition in transitions"
        :key="transition.key"
        class="map-transition-item"
        :data-transition="transition.key"
      >
        <MapEntityRow
          :entry="transition.entry"
          :disabled="!transition.empty && !transition.valid"
          :aria-label="
            transition.empty
              ? 'Выбрать тайл для перехода'
              : `${transition.label}: ${transition.entry.name}`
          "
          :title="transition.reason"
          @select="activate(transition)"
        >
          <template #details
            ><span class="map-transition-action"
              ><ArrowRight :size="16" aria-hidden="true" /><em>{{
                transition.label
              }}</em></span
            ></template
          >
        </MapEntityRow>
        <div v-if="transition.custom" class="map-transition-actions">
          <ActionButton
            v-if="transition.modelId"
            icon-only
            variant="quiet"
            aria-label="Изменить цель перехода"
            title="Изменить цель перехода"
            @click="choosing = transition.id"
            ><template #icon><Pencil :size="18" /></template
          ></ActionButton>
          <ActionButton
            icon-only
            variant="quiet"
            aria-label="Удалить кастомный переход"
            title="Удалить кастомный переход"
            @click="editor.removeTransition(entry.id, transition.id)"
            ><template #icon
              ><Trash2
                :size="18"
                :style="{ color: 'var(--danger)' }" /></template
          ></ActionButton>
        </div>
        <p v-if="transition.reason" class="map-hint">{{ transition.reason }}</p>
      </div>
    </TransitionGroup>
    <ActionButton
      v-if="entry.kind === 'tile'"
      variant="secondary"
      :disabled="customCount >= MAX_TILE_TRANSITIONS"
      @click="editor.addTransition(entry.id)"
      ><template #icon><Plus :size="18" /></template>Создать
      переход</ActionButton
    >
    <MapTileTransitionPicker
      v-if="chosen"
      :editor="editor"
      :selected-id="chosen.modelId"
      :excluded="excluded"
      @close="choosing = ''"
      @select="pick"
    />
  </MapInspectorSection>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { ArrowRight, Pencil, Plus, Trash2 } from "@lucide/vue";
import { transitionDocument, transitionLabel } from "../lib/modelTransitions";
import {
  displayedTransitions,
  MAX_TILE_TRANSITIONS,
} from "../lib/instanceTransitions";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapTileTransitionPicker from "./MapTileTransitionPicker.vue";
const props = defineProps({ editor: Object, entry: Object });
const choosing = ref("");
watch(
  () => props.entry.id,
  () => (choosing.value = ""),
);
const customCount = computed(
  () => props.entry.item.transitions?.targets.length || 0,
);
const chosen = computed(() =>
  props.entry.item.transitions?.targets.find((t) => t.id === choosing.value),
);
const excluded = computed(() => [
  props.entry.item.modelId,
  ...(props.entry.item.transitions?.targets || [])
    .filter((t) => t.id !== choosing.value)
    .map((t) => t.modelId),
]);
function pick(id) {
  props.editor.setTransitionTarget(props.entry.id, choosing.value, id);
  choosing.value = "";
}
function activate(transition) {
  if (transition.empty) choosing.value = transition.id;
  else if (transition.valid)
    props.editor.applyTransition(props.entry.kind, props.entry.id, transition);
}
const transitions = computed(() =>
  displayedTransitions(
    props.editor.draft.document,
    props.editor.catalogue,
    props.entry.kind,
    props.entry.id,
  ).map((transition) => {
    const result = transitionDocument(
      props.editor.draft.document,
      props.editor.catalogue,
      props.entry.kind,
      props.entry.id,
      transition,
    );
    return {
      ...transition,
      ...result,
      empty: transition.custom && !transition.modelId,
      label: transition.return
        ? "Вернуться"
        : transition.custom
          ? transition.modelId
            ? "Перейти"
            : "Выбрать тайл"
          : transitionLabel(transition.action),
      reason: transition.custom && !transition.modelId ? "" : result.reason,
      entry: {
        kind: props.entry.kind,
        name:
          result.target?.name ||
          (transition.custom && !transition.modelId
            ? "Выбрать тайл"
            : "Модель недоступна"),
        code: result.target?.definitionId,
        previewUrl: result.target?.previewUrl,
      },
    };
  }),
);
</script>
<style scoped>
.map-transition-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.map-transition-list:empty {
  display: none;
}
.map-transition-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.map-transition-item > .map-entity-row {
  flex: 1;
  min-width: 0;
}
.map-transition-item > p {
  width: 100%;
}
.map-transition-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.map-transition-action em {
  font-style: italic;
}
.map-transition-action {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}
.map-transition-enter-active,
.map-transition-leave-active,
.map-transition-move {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.map-transition-enter-from,
.map-transition-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .map-transition-enter-active,
  .map-transition-leave-active,
  .map-transition-move {
    transition: none;
  }
}
</style>
