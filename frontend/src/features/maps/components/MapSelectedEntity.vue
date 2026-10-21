<template>
  <MapFocusContent>
    <template #heading
      ><MapEntityHeading
        :entry="entry"
        :editable="
          entry.kind === 'area' ||
          (entry.kind === 'light' && !entry.item.builtinKey)
        "
        @rename="rename"
        @keydown.esc.capture="escape"
    /></template>
    <InspectorPreview :interactive="entry.kind === 'light'" :label="`Приблизить источник: ${entry.name}`" @activate="editor.focusLight(entry.id)">
        <slot name="preview"
          ><MapLightPreview
            v-if="entry.kind === 'light'"
            :entry="entry"
            :editor="editor"
          />
          <img
            v-else-if="entry.previewUrl"
            class="map-selection-preview"
            :src="entry.previewUrl"
            alt=""
            draggable="false"
          />
          <component
            v-else
            :is="
              ['player', 'creature', 'marker'].includes(entry.kind)
                ? UserRound
                : Box
            "
            :size="64"
            :style="{ color: entry.color }"
          />
        </slot>
      <template #actions>
        <ActionButton
          v-if="copyable"
          icon-only
          variant="quiet"
          aria-label="Скопировать элемент"
          title="Скопировать элемент"
          @click="editor.copy()"
        >
          <template #icon><Copy :size="18" /></template>
        </ActionButton>
        <ActionButton
          v-if="removable && !entry.item.builtinKey"
          icon-only
          variant="quiet"
          :aria-label="
            entry.kind === 'area'
              ? `Удалить область «${entry.name}»`
              : 'Удалить элемент'
          "
          :title="
            entry.kind === 'area'
              ? `Удалить область «${entry.name}»`
              : 'Удалить элемент'
          "
          @click="editor.removeSelected()"
        >
          <template #icon
            ><Trash2 :size="18" :style="{ color: 'var(--danger)' }"
          /></template>
        </ActionButton>
      </template>
    </InspectorPreview>
    <slot name="after-preview" />
    <slot />
  </MapFocusContent>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import InspectorPreview from "@/shared/ui/InspectorPreview.vue";
import MapEntityHeading from "./MapEntityHeading.vue";
import MapLightPreview from "./MapLightPreview.vue";
import MapFocusContent from "./MapFocusContent.vue";
import { Box, Copy, Trash2, UserRound } from "@lucide/vue";
const props = defineProps({
  entry: Object,
  editor: Object,
  copyable: { type: Boolean, default: true },
  removable: { type: Boolean, default: true },
});
function rename(value) {
  const { entry, editor } = props;
  if (!value) return;
  if (entry.kind === "area") editor.renameArea(entry.id, value);
  else {
    editor.finishLightEdit();
    editor.updateLight(entry.id, "name", value);
    editor.finishLightEdit();
  }
}
function escape(event) {
  if (!props.editor.dismissFocus) return;
  event.preventDefault();
  event.stopPropagation();
  props.editor.dismissFocus();
}
</script>
<style scoped>
.map-selection-preview {
  width: 100%;
  height: 150px;
  object-fit: contain;
}
</style>
