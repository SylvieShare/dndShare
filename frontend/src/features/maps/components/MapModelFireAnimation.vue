<template>
  <DetailSection v-if="hasModelFire(model)" label="Анимация огня">
    <FormField :label="`Частота анимации: ${fps} FPS`" vertical>
      <AppSlider
        :model-value="fps"
        :min="1"
        :max="60"
        :step="1"
        label="Частота анимации огня"
        @update:model-value="behaviour.animationFps = $event"
      />
    </FormField>
    <p class="map-hint">
      8–15 FPS — покадровое пламя, 24–60 FPS — плавное. Превью меняется сразу;
      сохранённая частота применяется ко всем экземплярам модели.
    </p>
  </DetailSection>
</template>
<script setup>
import { computed } from "vue";
import { AppSlider, DetailSection, FormField } from "@sylvieshare/share-ui";
import { hasModelFire, modelFireFPS } from "../lib/modelFire";
const props = defineProps({ model: Object, behaviour: Object });
const fps = computed(() => modelFireFPS({ behaviour: props.behaviour }));
</script>
