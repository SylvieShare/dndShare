<template>
  <div class="map-rating" :aria-busy="busy" @click.stop>
    <StarRating
      :model-value="editable ? modelValue : rating"
      :readonly="!editable"
      :disabled="busy"
      label="Ваша оценка карты"
      :value-label="`Средняя оценка ${formatted} из 5`"
      :option-labels="OPTIONS"
      @update:model-value="emit('rate', $event)"
    />
    <span class="map-rating-caption">{{
      count ? `${formatted} · ${count}` : "Пока нет оценок"
    }}</span>
    <ActionButton
      v-if="editable && modelValue"
      variant="quiet"
      :disabled="busy"
      @click="emit('rate', 0)"
      >Снять оценку</ActionButton
    >
  </div>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, StarRating } from "@sylvieshare/share-ui";
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
  editable: Boolean,
  busy: Boolean,
});
const emit = defineEmits(["rate"]);
const formatted = computed(() =>
  props.rating.toLocaleString("ru-RU", { maximumFractionDigits: 1 }),
);
const OPTIONS = Array.from({ length: 5 }, (_, i) => `${i + 1} из 5`);
</script>
<style scoped>
.map-rating {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.map-rating-caption {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
