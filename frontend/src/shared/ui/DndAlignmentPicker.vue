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

    <BasePopover v-model:open="open" :anchor="trigger" placement="bottom-start" :min-width="0" transition-preset="action-menu">
      <div class="alignment-popover" role="grid" aria-label="Мировоззрение">
        <ChoiceCard
          v-for="alignment in DND_ALIGNMENTS"
          :key="alignment"
          class="alignment-option"
          layout="icon"
          :label="alignment"
          :model-value="normalizedValue === alignment"
          role="gridcell"
          :aria-selected="normalizedValue === alignment"
          @update:model-value="select(alignment)"
        >
          <template #icon><component :is="alignmentIcons[alignment]" :stroke-width="1.6" aria-hidden="true" /></template>
        </ChoiceCard>
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BasePopover, ChoiceCard } from '@sylvieshare/share-ui'
import { Bird, CircleDot, Crown, Flame, HandHeart, Scale, ShieldCheck, Skull, Wind } from '@lucide/vue'
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
const alignmentIcons = {
  'Законно-добрый': ShieldCheck,
  'Нейтрально-добрый': HandHeart,
  'Хаотично-добрый': Bird,
  'Законно-нейтральный': Scale,
  'Нейтральный': CircleDot,
  'Хаотично-нейтральный': Wind,
  'Законно-злой': Crown,
  'Нейтрально-злой': Skull,
  'Хаотично-злой': Flame,
}

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
.alignment-popover {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-compact);
  width: min(var(--layout-morph-editor-width), calc(100vw - 2 * var(--spacing-page)));
}
.alignment-option {
  --choice-card-label-size: var(--type-context-size);
  --choice-card-label-line-height: var(--type-context-line-height);
}
</style>
