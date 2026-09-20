<template>
  <section class="map-display-settings">
    <strong>Экран стола</strong>
    <p class="map-hint">
      {{ display.visible ? 'Трансляция включена' : 'Экран затемнён' }}. Обзор мастера независим от
      стола.
    </p>
    <ActionButton
      variant="secondary"
      :disabled="busy || !display.mapId"
      @click="emit('update', { visible: !display.visible })"
      ><EyeOff v-if="display.visible" :size="16" /><Eye v-else :size="16" />{{
        display.visible ? 'Затемнить экран' : 'Показать карту'
      }}</ActionButton
    >
    <ToggleSwitch
      :model-value="display.camera.fit"
      label="Вписывать всю карту"
      :disabled="busy"
      @update:model-value="camera({ fit: $event })"
    />
    <template v-if="!display.camera.fit">
      <FormField label="Клетка, пикселей"
        ><FormNumberInput
          :value="Math.round(display.camera.cellPixels)"
          :min="8"
          :max="400"
          @change="camera({ cellPixels: $event })"
      /></FormField>
      <p class="map-hint">
        Для миниатюр измерьте клетку линейкой на мониторе. После калибровки масштаб останется
        фиксированным.
      </p>
      <FormField label="Нужно, мм"
        ><FormNumberInput :value="desired" :min="10" :max="100" @change="desired = $event"
      /></FormField>
      <FormField label="Измерено, мм"
        ><FormNumberInput :value="measured" :min="5" :max="200" @change="measured = $event"
      /></FormField>
      <ActionButton
        variant="secondary"
        :disabled="busy"
        @click="
          camera({
            cellPixels: Math.max(
              8,
              Math.min(400, (display.camera.cellPixels * desired) / measured),
            ),
          })
        "
        >Применить калибровку</ActionButton
      >
    </template>
    <ActionButton variant="secondary" :disabled="busy || !selectedOnAir" @click="emit('frame')"
      ><Focus :size="16" />Перенести центр обзора на стол</ActionButton
    >
    <ActionButton
      variant="secondary"
      :disabled="busy"
      @click="camera({ rotation: (display.camera.rotation + 90) % 360 })"
      ><RotateCw :size="16" />Поворот стола: {{ display.camera.rotation }}°</ActionButton
    >
    <a :href="path" target="_blank" rel="noopener noreferrer" class="map-screen-link"
      ><ExternalLink :size="16" />Открыть экран карты</a
    >
    <ActionButton variant="quiet" @click="copy"><Copy :size="15" />{{ copyLabel }}</ActionButton>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { ActionButton, FormField, FormNumberInput, ToggleSwitch } from '@sylvieshare/share-ui';
import { Copy, ExternalLink, Eye, EyeOff, Focus, RotateCw } from '@lucide/vue';
const props = defineProps({
    display: { type: Object, required: true },
    path: String,
    busy: Boolean,
    selectedOnAir: Boolean,
  }),
  emit = defineEmits(['update', 'frame']);
const desired = ref(25),
  measured = ref(25),
  copyLabel = ref('Скопировать ссылку');
function camera(patch) {
  if (!props.busy) emit('update', { camera: { ...props.display.camera, ...patch } });
}
async function copy() {
  try {
    await navigator.clipboard.writeText(new URL(props.path, location.origin).href);
    copyLabel.value = 'Ссылка скопирована';
  } catch {
    copyLabel.value = 'Не удалось скопировать; откройте ссылку выше';
  }
}
</script>
<style scoped>
.map-display-settings {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.map-screen-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-size: 13px;
}
</style>
