<template>
  <div @keydown.stop>
    <AddButton
      ref="trigger"
      variant="icon"
      label="Добавить источник света"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled="disabled"
      @click="open = !open"
    />
    <BasePopover
      v-model:open="open"
      :anchor="trigger?.$el"
      :min-width="240"
      :z-index="3400"
      role="menu"
      aria-label="Пресет источника света"
    >
      <div class="map-light-presets" @keydown.stop="navigate">
        <ActionButton
          v-for="(preset, index) in LIGHT_PRESETS"
          :key="preset.kind"
          :ref="(el) => (options[index] = el?.$el)"
          variant="quiet"
          role="menuitem"
          @click="pick(preset.kind, $event)"
        >
          <template #icon
            ><component
              :is="icons[preset.kind]"
              :size="20"
              :style="{ color: preset.color }" /></template
          >{{ preset.name }}
        </ActionButton>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { nextTick, ref, watch } from "vue";
import { ActionButton, AddButton, BasePopover } from "@sylvieshare/share-ui";
import { Flame, Lightbulb, Sparkles } from "@lucide/vue";
import { LIGHT_PRESETS } from "../lib/mapLighting";
defineProps({ disabled: Boolean });
const emit = defineEmits(["place-light"]),
  open = ref(false),
  trigger = ref(null),
  options = [];
const icons = { torch: Flame, candle: Lightbulb, magic: Sparkles };
function pick(kind, event) {
  open.value = false;
  emit("place-light", kind, event.detail === 0 ? { type: "keydown" } : event);
}
function navigate(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    open.value = false;
    trigger.value?.$el.focus();
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
        ? options.length - 1
        : (current + delta + options.length) % options.length;
  options[index]?.focus();
}
watch(open, async (value) => {
  if (value) {
    await nextTick();
    options[0]?.focus();
  }
});
</script>
<style scoped>
.map-light-presets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
