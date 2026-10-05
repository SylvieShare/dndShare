<template>
  <section class="map-editor-settings" aria-label="Настройки редактора">
    <ToggleSwitch
      label="Показывать точки размещения"
      :model-value="editor.showAnchors"
      @update:model-value="editor.showAnchors = $event"
    />
    <ToggleSwitch
      v-if="editor.draft.document.kind !== 'image'"
      label="Показывать сетку"
      :model-value="editor.draft.document.grid.visible"
      @update:model-value="
        editor.change((m) => {
          m.document.grid.visible = $event;
        })
      "
    />
  </section>
</template>
<script setup>
import { ToggleSwitch } from "@sylvieshare/share-ui";
defineProps({ editor: Object });
</script>
<style scoped>
.map-editor-settings {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
