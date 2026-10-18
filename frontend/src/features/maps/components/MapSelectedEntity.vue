<template>
  <MapFocusContent>
    <template #heading
      ><MapEntityHeading
        :entry="entry"
        :editable="
          entry.kind === 'area' ||
          (['light', 'effect'].includes(entry.kind) &&
            !entry.item.builtinKey) ||
          entry.kind === 'flag'
        "
        @rename="rename"
        @keydown.esc.capture="escape"
    /></template>
    <div class="map-selected-visual">
      <BaseTile
        class="map-selected-frame"
        framed
        :role="entry.kind === 'light' ? 'button' : undefined"
        :tabindex="entry.kind === 'light' ? 0 : undefined"
        :aria-label="
          entry.kind === 'light'
            ? `Приблизить источник: ${entry.name}`
            : undefined
        "
        @dblclick.stop="entry.kind === 'light' && editor.focusLight(entry.id)"
        @keydown.enter.self.prevent="
          entry.kind === 'light' && editor.focusLight(entry.id)
        "
      >
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
      </BaseTile>
      <div class="map-selected-buttons">
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
      </div>
    </div>
    <slot name="after-preview" />
    <slot />
  </MapFocusContent>
</template>
<script setup>
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
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
  else if (entry.kind === "effect") {
    editor.updateEffect(entry.id, "name", value);
    editor.finishComponentEdit();
  } else {
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
.map-selected-visual {
  display: flex;
  gap: 8px;
}
.map-selected-frame {
  --surface: var(--map-model-preview-bg);
  flex: 1;
  min-width: 0;
  height: 150px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.map-selection-preview {
  width: 100%;
  height: 150px;
  object-fit: contain;
}
.map-selected-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
