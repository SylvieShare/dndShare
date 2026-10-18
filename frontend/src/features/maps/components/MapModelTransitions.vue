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
        :class="{ 'map-transition-custom': transition.custom }"
        :data-transition="transition.key"
      >
        <MapEntityRow
          :entry="transition.entry"
          :selectable="!!transition.custom"
          @select="choosing = transition.id"
        >
          <template #actions>
            <ActionButton
              v-if="!transition.custom"
              variant="secondary"
              :disabled="!transition.valid"
              :title="transition.reason"
              @click.stop="
                editor.applyTransition(entry.kind, entry.id, transition)
              "
            >
              {{
                transition.return
                  ? "Вернуться"
                  : transition.custom
                    ? "Перейти"
                    : transitionLabel(transition.action)
              }}
            </ActionButton>
          </template>
        </MapEntityRow>
        <ActionButton
          v-if="transition.custom"
          icon-only
          variant="quiet"
          class="map-transition-delete"
          aria-label="Удалить кастомный переход"
          title="Удалить кастомный переход"
          @click="editor.removeTransition(entry.id, transition.id)"
          ><template #icon
            ><Trash2 :size="18" :style="{ color: 'var(--danger)' }" /></template
        ></ActionButton>
        <ActionButton
          v-if="transition.custom"
          class="map-transition-go"
          variant="secondary"
          :disabled="!transition.valid"
          :title="transition.reason"
          @click="editor.applyTransition(entry.kind, entry.id, transition)"
          >Перейти</ActionButton
        >
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
import { Plus, Trash2 } from "@lucide/vue";
import { transitionDocument, transitionLabel } from "../lib/modelTransitions";
import {
  instanceTransitions,
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
const transitions = computed(() =>
  instanceTransitions(
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}
.map-transition-item > p {
  grid-column: 1 / -1;
}
.map-transition-item > :first-child {
  grid-column: 1;
}
.map-transition-item:not(.map-transition-custom) > :first-child {
  grid-column: 1 / -1;
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
.map-transition-go {
  grid-column: 1 / -1;
}
.map-transition-delete {
  grid-column: 2;
  grid-row: 1;
}
</style>
