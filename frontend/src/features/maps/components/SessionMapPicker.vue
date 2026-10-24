<template>
  <AppModalFrame
    :title="
      mode === 'library'
        ? 'Добавить 3D карту'
        : mode === 'image'
          ? 'Добавить 2D карту'
          : 'Добавить карту'
    "
    :width="1100"
    close-label="Закрыть выбор карты"
    @close="emit('close')"
  >
    <div class="session-map-picker-actions">
      <ActionButton
        v-if="mode !== 'choose'"
        variant="quiet"
        @click="mode = 'choose'"
        ><template #icon><ArrowLeft :size="16" /></template>Тип
        карты</ActionButton
      >
      <template v-else
        ><ActionButton variant="secondary" @click="mode = 'library'"
          ><template #icon><Plus :size="16" /></template>Добавить новую 3D
          карту</ActionButton
        ><ActionButton variant="secondary" @click="mode = 'image'"
          ><template #icon><Image :size="16" /></template>Добавить 2D
          карту</ActionButton
        ></template
      >
    </div>
    <MapLibrary
      v-if="mode === 'library'"
      picker
      @select="emit('add', $event)"
    />
    <SessionMapImageForm
      v-else-if="mode === 'image'"
      :uuid="uuid"
      @created="emit('created', $event)"
    />
  </AppModalFrame>
</template>
<script setup>
import { ref } from "vue";
import { ActionButton, AppModalFrame } from "@sylvieshare/share-ui";
import { ArrowLeft, Image, Plus } from "@lucide/vue";
import MapLibrary from "./MapLibrary.vue";
import SessionMapImageForm from "./SessionMapImageForm.vue";
defineProps({ uuid: String });
const emit = defineEmits(["close", "add", "created"]);
const mode = ref("choose");
</script>
<style scoped>
.session-map-picker-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
</style>
