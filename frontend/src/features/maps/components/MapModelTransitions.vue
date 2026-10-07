<template>
  <MapInspectorSection
    title="Переходы"
    v-if="transitions.length"
    class="model-transitions"
    aria-label="Переходы модели"
  >
    <div v-for="transition in transitions" :key="transition.id">
      <MapEntityRow :entry="transition.entry" :selectable="false">
        <template #actions>
          <ActionButton
            variant="secondary"
            :disabled="!transition.valid"
            :title="transition.reason"
            @click.stop="
              editor.applyTransition(entry.kind, entry.id, transition)
            "
          >
            {{ transitionLabel(transition.action) }}
          </ActionButton>
        </template>
      </MapEntityRow>
      <p v-if="transition.reason" class="map-hint">{{ transition.reason }}</p>
    </div>
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { transitionDocument, transitionLabel } from "../lib/modelTransitions";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object, entry: Object });
const transitions = computed(() =>
  (props.entry.model?.behaviour?.transitions || []).map((transition) => {
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
      entry: {
        kind: props.entry.kind,
        name: result.target?.name || "Модель недоступна",
        code: result.target?.sourceCode,
        previewUrl: result.target?.previewUrl,
      },
    };
  }),
);
</script>
<style scoped>
.model-transitions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h4 {
  margin: 0;
  font-size: 14px;
}
</style>
