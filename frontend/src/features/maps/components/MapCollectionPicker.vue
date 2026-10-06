<template>
  <div class="map-collection-picker" @keydown.stop>
    <ActionButton
      ref="trigger"
      variant="secondary"
      :icon-only="compact"
      class="map-pack-trigger"
      role="combobox"
      aria-label="Пак тайлов"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :aria-expanded="open"
      :title="selected?.name"
      :disabled="!packs.length"
      @click="open = !open"
      @keydown.down.prevent="show"
      @keydown.up.prevent="show"
    >
      <template #icon
        ><MapPackIcon :pack="modelValue" :size="compact ? 30 : 40" />
        <span v-if="!compact" class="map-pack-label"
          ><small>Пак тайлов</small
          ><strong>{{ selected?.name || "Выберите пак" }}</strong></span
        >
        <ChevronDown v-if="!compact" :size="16" aria-hidden="true"
      /></template>
    </ActionButton>
    <BasePopover
      v-model:open="open"
      :anchor="trigger?.$el"
      :min-width="260"
      :z-index="3400"
      :id="listboxId"
      role="listbox"
      aria-label="Паки тайлов"
    >
      <div class="map-pack-options" @keydown.stop="navigate">
        <BaseTile
          v-for="(pack, index) in packs"
          :key="pack.id"
          :ref="(el) => (options[index] = el?.$el)"
          interactive
          :framed="pack.id === modelValue"
          :tint="pack.id === modelValue"
          class="map-pack-option"
          role="option"
          :aria-label="pack.name"
          :aria-selected="pack.id === modelValue"
          tabindex="0"
          @click="pick(pack.id)"
          @keydown.enter.prevent="pick(pack.id)"
          @keydown.space.prevent="pick(pack.id)"
        >
          <MapPackIcon :pack="pack.id" />
          <span class="map-pack-label"
            ><strong>{{ pack.name }}</strong
            ><small>Тайлов: {{ pack.count }}</small></span
          >
          <Check v-if="pack.id === modelValue" :size="16" aria-hidden="true" />
        </BaseTile>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { computed, nextTick, ref, useId, watch } from "vue";
import { ActionButton, BasePopover, BaseTile } from "@sylvieshare/share-ui";
import { Check, ChevronDown } from "@lucide/vue";
import MapPackIcon from "./MapPackIcon.vue";
import { modelCollections } from "../lib/modelCollections";
const props = defineProps({
  catalogue: Array,
  modelValue: String,
  compact: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const listboxId = `map-packs-${useId()}`;
const open = ref(false),
  trigger = ref(null),
  options = [];
const packs = computed(() => modelCollections(props.catalogue || []));
const selected = computed(() =>
  packs.value.find((p) => p.id === props.modelValue),
);
function show() {
  open.value = true;
}
function close() {
  open.value = false;
  trigger.value?.$el.focus();
}
function pick(id) {
  emit("update:modelValue", id);
  close();
}
function navigate(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  const delta = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!delta && !["Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const current = options.indexOf(document.activeElement);
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? packs.value.length - 1
        : (current + delta + packs.value.length) % packs.value.length;
  options[index]?.focus();
}
watch(open, async (value) => {
  if (!value) return;
  await nextTick();
  options[
    Math.max(
      0,
      packs.value.findIndex((p) => p.id === props.modelValue),
    )
  ]?.focus();
});
</script>
<style scoped>
.map-collection-picker {
  width: 100%;
  max-width: 286px;
}
.map-pack-trigger {
  width: 100%;
  justify-content: flex-start;
  padding: 8px;
}
.map-pack-label {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  text-align: left;
}
.map-pack-label strong {
  font-size: 13px;
}
.map-pack-label small {
  font-size: 10px;
  color: var(--text-muted);
}
.map-pack-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: min(420px, 65vh);
  overflow: auto;
}
.map-pack-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  cursor: pointer;
}
.map-pack-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
