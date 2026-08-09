<template>
  <div
    class="int-block"
    :class="{
      'int-block-compact': variant === 'compact',
      'int-block-mini': variant === 'mini',
      'int-block-tile': variant === 'tile',
      'int-block-editable': charCtx.ownerMode,
    }"
    @click="charCtx.ownerMode && (modalOpen = true)"
  >
    <template v-if="variant === 'tile'">
      <div v-if="block.title" class="int-title">{{ block.title }}</div>
      <div class="int-display">
        <span v-if="showPlus" class="int-plus">+</span>
        <span class="int-value">{{ displayValue }}</span>
      </div>
      <div v-if="block.content?.subtitle" class="int-subtitle">{{ block.content.subtitle }}</div>
    </template>
    <template v-else>
      <div class="int-display">
        <span v-if="showPlus" class="int-plus">+</span>
        <span class="int-value">{{ displayValue }}</span>
        <img v-if="block.content?.svg" class="int-svg" :src="block.content.svg" />
      </div>
      <div v-if="block.title" class="int-title">{{ block.title }}</div>
    </template>

    <InputIntModal
      v-if="modalOpen"
      :data="numData"
      :title="block.title"
      @close="modalOpen = false"
      @change="onModalChange"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { sumBonuses } from '@/shared/lib/dnd'
import InputIntModal from './InputIntModal'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const modalOpen = ref(false)
const numData = computed(() => {
  if (props.value && typeof props.value === 'object') return props.value
  return { base: parseInt(props.value) || 0, bonuses: [] }
})
const displayValue = computed(() => {
  const d = numData.value
  return (d.base || 0) + sumBonuses(d.bonuses)
})
const showPlus = computed(() => props.block.content?.visible_plus && displayValue.value > 0)
const variant = computed(() => props.block.props?.variant || props.block.content?.variant || '')

function onModalChange(data) {
  emit('update:value', props.block.id, data)
}
</script>

<style scoped>
.int-block {
  width: 100px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.int-block-editable {
  cursor: pointer;
}

.int-block-compact {
  width: 76px;
  height: 76px;
  aspect-ratio: 1 / 1;
  min-width: 76px;
  border-radius: 10px;
  gap: 2px;
}

.int-block-compact .int-plus { font-size: 18px; }
.int-block-compact .int-value { font-size: 22px; min-width: 16px; }
.int-block-compact .int-title { font-size: 10px; line-height: 1.1; padding: 0 4px; }

.int-block-mini {
  width: auto;
  height: auto;
  background: none;
  border-radius: 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0;
}

.int-block-mini .int-title { font-size: 10px; padding: 0; }
.int-block-mini .int-display { align-items: center; gap: 0; }
.int-block-mini .int-svg { margin-left: 2px; }
.int-block-mini .int-plus { font-size: 16px; color: var(--text-2); }
.int-block-mini .int-value { font-size: 20px; font-weight: 800; min-width: 14px; color: var(--text-1); }

.int-display { display: flex; align-items: center; }

.int-plus {
  color: var(--text-1);
  font-size: 24px;
  font-weight: bold;
  line-height: 1;
}

.int-value {
  color: var(--text-1);
  font-size: 28px;
  font-weight: bold;
  text-align: center;
  min-width: 20px;
}

.int-title {
  color: var(--text-2);
  font-size: 12px;
  text-align: center;
  padding: 0 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.int-svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.8;
}

/* ── Tile variant ── */
.int-block-tile {
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 2px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.int-block-tile.int-block-editable:hover { border-color: var(--border-strong); }

.int-block-tile .int-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0;
}

.int-block-tile .int-display { align-items: baseline; gap: 1px; }
.int-block-tile .int-plus  { font-size: 16px; color: var(--text-2); }
.int-block-tile .int-value { font-size: 28px; font-weight: 800; min-width: 0; }

.int-subtitle {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
