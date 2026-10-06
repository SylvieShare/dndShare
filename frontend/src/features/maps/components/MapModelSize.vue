<template>
  <BaseTile class="model-size">
    <div class="model-size-heading">
      <strong>Занимаемые клетки</strong
      ><span>{{ model.width }} × {{ model.height }}</span>
    </div>
    <div class="model-size-layout">
      <svg
        viewBox="0 0 208 208"
        role="grid"
        aria-label="Превью размера тайла"
        tabindex="0"
        :aria-disabled="disabled"
        :aria-rowcount="8"
        :aria-colcount="8"
        @keydown="navigate"
        @mouseleave="hover = null"
      >
        <g v-for="y in 8" :key="y" role="row">
          <rect
            v-for="x in 8"
            :key="x"
            :x="8 + (x - 1) * 24"
            :y="8 + (y - 1) * 24"
            width="21"
            height="21"
            rx="3"
            role="gridcell"
            :aria-label="`${x} × ${y} клетки`"
            :aria-selected="x === model.width && y === model.height"
            :class="{
              occupied: x <= model.width && y <= model.height,
              proposed: hover && x <= hover.x && y <= hover.y,
            }"
            @mouseenter="hover = { x, y }"
            @click="choose(x, y)"
          />
        </g>
      </svg>
      <div class="model-size-fields">
        <FormField label="Ширина · X" vertical
          ><FormTextInput
            type="number"
            :value="model.width"
            min="1"
            max="8"
            step="1"
            required
            aria-label="Ширина тайла в клетках"
            @update:value="model.width = Number($event)"
        /></FormField>
        <FormField label="Длина · Z" vertical
          ><FormTextInput
            type="number"
            :value="model.height"
            min="1"
            max="8"
            step="1"
            required
            aria-label="Длина тайла в клетках"
            @update:value="model.height = Number($event)"
        /></FormField>
      </div>
    </div>
    <p class="map-hint">
      {{ model.width * model.height }} клеток · выберите прямоугольник на сетке.
    </p>
  </BaseTile>
</template>
<script setup>
import { ref } from "vue";
import { BaseTile, FormField, FormTextInput } from "@sylvieshare/share-ui";
const props = defineProps({ model: Object, disabled: Boolean });
const hover = ref(null);
function choose(x, y) {
  if (props.disabled) return;
  props.model.width = x;
  props.model.height = y;
}
function navigate(event) {
  const moves = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };
  const move = moves[event.key];
  if (move || event.key === "Enter" || event.key === " ")
    event.preventDefault();
  if (move)
    choose(
      Math.max(1, Math.min(8, props.model.width + move[0])),
      Math.max(1, Math.min(8, props.model.height + move[1])),
    );
  if ((event.key === "Enter" || event.key === " ") && hover.value)
    choose(hover.value.x, hover.value.y);
}
</script>
<style scoped>
.model-size {
  padding: 14px;
}
.model-size-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.model-size-heading span {
  color: var(--accent-soft);
  font-family: var(--font-mono);
}
.model-size-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px;
  align-items: center;
  gap: 12px;
  margin: 10px 0;
}
svg {
  width: 100%;
  max-height: 190px;
  touch-action: none;
}
rect {
  fill: var(--surface-raised);
  stroke: var(--border-strong);
  cursor: pointer;
  transition: fill 0.12s;
}
rect.occupied {
  fill: color-mix(in srgb, var(--accent) 55%, var(--surface));
  stroke: var(--accent-soft);
}
rect.proposed {
  fill: color-mix(in srgb, var(--accent-soft) 38%, var(--surface));
}
.model-size-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
