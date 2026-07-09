<template>
  <EditorPanel compact>
    <EditorSection :title="title">
      <template #actions>
        <button class="bsp-add-btn" type="button" title="Добавить вариант" @click="createOpen = true">
          <span class="bsp-plus"><span class="bsp-plus-h"></span><span class="bsp-plus-v"></span></span>
        </button>
      </template>
    <div class="bsp-list">
      <button
        v-for="item in items"
        :key="item.id"
        class="bsp-item"
        :class="{ 'bsp-item--on': activeIds.includes(item.id) }"
        :style="{ '--c': item.color || 'var(--text-muted)' }"
        type="button"
        @click="$emit('toggle', item.id)"
      >
        <span class="bsp-icon">
          <SvgIcon v-if="item.svg" class="bsp-svg" :svg="item.svg" :color="item.color || '#888888'" filter />
          <span v-else class="bsp-dot"></span>
        </span>
        <span class="bsp-name">{{ item.value }}</span>
        <span class="bsp-check">✓</span>
        <span
          v-if="item.desc"
          class="bsp-info"
          @click.stop="toggleTip($event, item)"
        >?</span>
      </button>

      <div v-if="!items.length" class="bsp-empty">Нет вариантов</div>
    </div>
    </EditorSection>

    <ItemTooltip
      v-if="tip.visible"
      :title="tip.title"
      :desc="tip.desc"
      :x="tip.x"
      :top="tip.top"
      :bottom="tip.bottom"
    />

    <SuggestEditModal
      v-if="createOpen"
      :type-id="suggestTypeId"
      @close="createOpen = false"
      @created="onCreated"
    />
  </EditorPanel>
</template>

<script setup>
import { ref } from 'vue'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SuggestEditModal from '@/shared/ui/SuggestEditModal'
import SvgIcon from '@/shared/ui/SvgIcon'

defineProps({
  suggestTypeId: { type: [Number, String], required: true },
  items: { type: Array, default: () => [] },
  activeIds: { type: Array, default: () => [] },
  title: { type: String, default: 'Выбор статусов' },
})

const emit = defineEmits(['toggle', 'created'])
const createOpen = ref(false)
const tip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

function showTip(event, item) {
  if (!item.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 160
  tip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: Math.max(8, Math.min(rect.left - 380, window.innerWidth - 388)),
    top: above ? null : rect.bottom + 6,
    bottom: above ? window.innerHeight - rect.top + 6 : null,
  }
}

function hideTip() {
  tip.value.visible = false
}

function toggleTip(event, item) {
  if (tip.value.visible) {
    hideTip()
    return
  }
  showTip(event, item)
}

function onCreated(item) {
  createOpen.value = false
  emit('created', item)
}
</script>

<style scoped>
.bsp-add-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  border: 1px dashed var(--border-strong);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

@media (hover: hover) {
  .bsp-add-btn:hover {
    border-color: var(--accent);
    color: var(--text-2);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
}

.bsp-plus {
  position: relative;
  width: 10px;
  height: 10px;
  display: block;
}

.bsp-plus-h,
.bsp-plus-v {
  position: absolute;
  background: currentColor;
  border-radius: 1px;
}

.bsp-plus-h { width: 10px; height: 2px; top: 4px; left: 0; }
.bsp-plus-v { width: 2px; height: 10px; top: 0; left: 4px; }

.bsp-list {
  display: grid;
  gap: 6px;
  max-height: min(360px, 48vh);
  overflow-y: auto;
  padding-right: 2px;
}

.bsp-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: color-mix(in srgb, #fff 2%, var(--block-bg));
  color: var(--text-2);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

@media (hover: hover) {
  .bsp-item:hover {
    border-color: color-mix(in srgb, var(--c) 38%, var(--border));
    background: color-mix(in srgb, var(--c) 8%, var(--block-bg));
  }
}

.bsp-item--on {
  border-color: color-mix(in srgb, var(--c) 48%, var(--border));
  background: color-mix(in srgb, var(--c) 10%, var(--block-bg));
}

.bsp-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bsp-svg {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bsp-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
}

.bsp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.bsp-item--on .bsp-name {
  color: var(--c);
  font-weight: 700;
}

.bsp-check {
  flex-shrink: 0;
  color: var(--c);
  opacity: 0;
  transition: opacity 0.12s;
}

.bsp-item--on .bsp-check {
  opacity: 1;
}

.bsp-info {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid currentColor;
  color: color-mix(in srgb, var(--c) 50%, var(--text-muted));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
}

.bsp-empty {
  padding: 14px 4px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
