<template>
  <section class="map-cameras-panel">
    <ActionButton @click="editor.placeCamera"
      ><template #icon><Plus :size="17" /></template>Добавить
      камеру</ActionButton
    >
    <p class="map-hint">
      Поставьте камеру на поле. Направление и размер кадра меняются в её
      настройках.
    </p>
    <BaseTile
      v-for="camera in editor.draft.document.cameras || []"
      :key="camera.id"
      interactive
      :tint="editor.selectedCamera === camera.id"
      :framed="editor.selectedCamera === camera.id"
      class="map-camera-row"
      role="button"
      tabindex="0"
      :aria-label="camera.name"
      @click="editor.focusCamera(camera.id)"
      @keydown.enter="editor.focusCamera(camera.id)"
      ><Camera :size="24" /><strong>{{ camera.name }}</strong></BaseTile
    >
    <p v-if="!editor.draft.document.cameras?.length" class="map-hint">
      Сохранённых камер пока нет.
    </p>
  </section>
</template>
<script setup>
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import { Camera, Plus } from "@lucide/vue";
defineProps({ editor: Object });
</script>
<style scoped>
.map-cameras-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.map-camera-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
}
</style>
