<template>
  <div class="alignment-picker">
    <button
      v-if="editable"
      ref="trigger"
      class="alignment-trigger"
      :class="{ 'alignment-trigger--empty': !normalizedValue }"
      type="button"
      :aria-expanded="open"
      aria-haspopup="grid"
      @click="open = !open"
    >
      <span>{{ normalizedValue || placeholder }}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <span v-else class="alignment-readonly">{{ normalizedValue || placeholder }}</span>

    <BasePopover v-model:open="open" :anchor="trigger" placement="bottom-start" :min-width="330">
      <div class="alignment-popover" role="grid" aria-label="Мировоззрение">
        <button
          v-for="alignment in DND_ALIGNMENTS"
          :key="alignment"
          class="alignment-option"
          :class="{ 'alignment-option--active': normalizedValue === alignment }"
          type="button"
          role="gridcell"
          :aria-selected="normalizedValue === alignment"
          @click="select(alignment)"
        >{{ alignment }}</button>
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { DND_ALIGNMENTS, normalizeDndAlignment } from '@/shared/lib/dndAlignment'

const props = defineProps({
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: true },
  placeholder: { type: String, default: 'Выбрать мировоззрение' },
})
const emit = defineEmits(['update:modelValue'])
const trigger = ref(null)
const open = ref(false)
const normalizedValue = computed(() => normalizeDndAlignment(props.modelValue))

function select(value) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<style scoped>
.alignment-picker { min-width: 0; }
.alignment-trigger {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.alignment-trigger--empty { color: var(--text-muted); }
.alignment-trigger svg { width: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.alignment-readonly { display: inline-flex; min-height: 28px; align-items: center; color: var(--text-1); font-size: 15px; }
.alignment-popover { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: min(420px, calc(100vw - 32px)); padding: 7px; }
.alignment-option {
  min-height: 54px;
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.25;
  cursor: pointer;
}
.alignment-option:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); color: var(--text-1); }
.alignment-option--active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, var(--surface)); color: var(--accent-soft); }
@media (max-width: 390px) { .alignment-popover { gap: 4px; padding: 5px; }.alignment-option { min-height: 50px; padding: 5px 3px; font-size: 10px; } }
</style>
