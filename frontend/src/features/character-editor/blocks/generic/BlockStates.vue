<template>
  <!-- ── Compact variant ── -->
  <div v-if="isCompact" class="bs-compact" ref="root">
    <div class="bs-compact-icons">
      <div
        v-for="item in activeItems"
        :key="item.id"
        class="bs-compact-chip"
        :style="{ '--c': item.color || 'var(--text-muted)' }"
        @mouseenter="showTooltip($event, item)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon v-if="item.svg" class="bs-compact-svg-img" :svg="item.svg" :color="item.color || '#888888'" filter />
        <span v-else class="bs-compact-dot"></span>
      </div>
    </div>
    <button v-if="canInteract" class="bs-compact-btn" @click="panelOpen = true">
      <span class="bs-plus"><span class="bs-plus-h"></span><span class="bs-plus-v"></span></span>
      <span class="bs-compact-btn-label">{{ block.title || 'статус' }}</span>
    </button>
  </div>

  <!-- ── Only add button variant ── -->
  <div v-else-if="isOnlyAddButton" class="bs-block bs-block-only-add" ref="root">
    <div class="bs-only-add">
      <SuggestAdd
        v-if="canInteract"
        :title="block.title || 'статус'"
        :suggest-type-id="block.content.suggest_id"
        :exclude="activeItems.map(item => item.value)"
        filter-picked
        @pick="addByValue"
      />
    </div>
  </div>

  <!-- ── Summary tile variant: one tile + vertical morph picker ── -->
  <div v-else-if="isSummaryTile" class="bs-block" ref="root">
    <BaseTile
      class="bs-summary-tile"
      :color="summaryColor"
      :strip="!!activeItems.length"
      :interactive="canInteract"
      @click="openSummary"
    >
      <BlockStatesSummaryView
        :active-items="activeItems"
        label="Статусы"
        :editable="canInteract"
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />
    </BaseTile>
  </div>

  <!-- ── Default variant: statuses as tiles (strip + icon + name) ── -->
  <div v-else class="bs-block" ref="root">
    <div class="bs-tiles" :class="{ 'bs-chips-one-line': isOneLine }">
      <BaseTile
        v-for="item in activeItems"
        :key="item.id"
        class="bs-tile"
        :color="item.color || 'var(--text-muted)'"
        strip
        @mouseenter="showTooltip($event, item)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon v-if="item.svg" class="bs-tile-svg" :svg="item.svg" :color="item.color || '#888888'" filter />
        <span class="bs-tile-name">{{ item.value }}</span>
      </BaseTile>

      <button v-if="canShowAddButton" class="bs-add-tile" @click="panelOpen = true">
        <span class="bs-plus"><span class="bs-plus-h"></span><span class="bs-plus-v"></span></span>
        <span class="bs-compact-btn-label">{{ block.title || 'статус' }}</span>
      </button>

      <span v-if="!activeItems.length && !canInteract" class="bs-empty">—</span>
    </div>
  </div>

  <!-- ── Shared: panel + tooltip ── -->
  <SuggestMultiSelect
    v-if="panelOpen"
    :suggest-type-id="block.content.suggest_id"
    :items="allItems"
    :active-ids="activeIds"
    :title="block.title || 'Статусы'"
    @toggle="toggleItem"
    @close="panelOpen = false"
    @created="item => suggestStore.addItem(block.content.suggest_id, item)"
  />
  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="summaryColor"
    orientation="vertical"
    :min-view-width="340"
    @close="close"
  >
    <template #view>
      <BlockStatesSummaryView
        :active-items="activeItems"
        label="Статусы"
        panel
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />
    </template>
    <template #editor>
      <BlockStatesPickerEditor
        :suggest-type-id="block.content.suggest_id"
        :items="allItems"
        :active-ids="activeIds"
        title="Выбор статусов"
        @toggle="toggleItem"
        @created="item => suggestStore.addItem(block.content.suggest_id, item)"
      />
    </template>
  </MorphEditorShell>
  <ItemTooltip
    v-if="tooltip.visible"
    :title="tooltip.title"
    :desc="tooltip.desc"
    :x="tooltip.x"
    :top="tooltip.top"
    :bottom="tooltip.bottom"
  />
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import BlockStatesPickerEditor from '@/features/character-editor/blocks/generic/components/BlockStatesPickerEditor'
import BlockStatesSummaryView from '@/features/character-editor/blocks/generic/components/BlockStatesSummaryView'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import SuggestAdd from '@/shared/ui/SuggestAdd'
import SuggestMultiSelect from '@/shared/ui/SuggestMultiSelect'
import SvgIcon from '@/shared/ui/SvgIcon'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
const panelOpen = ref(false)
const root = ref(null)
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()
const suggestStore = computed(() => useSuggestStore())
const allItems = computed(() => useSuggestStore().items(props.block.content.suggest_id))
const activeIds = computed(() => Array.isArray(props.value) ? props.value : [])
const activeItems = computed(() => allItems.value.filter(i => activeIds.value.includes(i.id)))
const canInteract = computed(() => charCtx.ownerMode)
const variant = computed(() => props.block.props?.variant || props.block.content?.variant || '')
const isCompact = computed(() => variant.value === 'compact')
const isOnlyAddButton = computed(() => variant.value === 'only_add_button')
const isOnlyStates = computed(() => variant.value === 'only_states')
const isSummaryTile = computed(() => variant.value === 'summary_tile')
const isOneLine = computed(() => props.block.props?.one_line || props.block.content?.one_line || false)
const canShowAddButton = computed(() => canInteract.value && !isOnlyStates.value)
const summaryColor = computed(() => activeItems.value[0]?.color || 'var(--accent)')

onMounted(() => {
  useSuggestStore().ensure(props.block.content.suggest_id)
})

function addByValue(value) {
  const item = allItems.value.find(it => it.value === value)
  if (!item || activeIds.value.includes(item.id)) return
  emit('update:value', props.block.id, [...activeIds.value, item.id])
}

function toggleItem(id) {
  if (activeIds.value.includes(id)) {
    emit('update:value', props.block.id, activeIds.value.filter(v => v !== id))
  } else {
    emit('update:value', props.block.id, [...activeIds.value, id])
  }
}

function openSummary(event) {
  if (!canInteract.value) return
  hideTooltip()
  open(event)
}

function showTooltip(event, item) {
  if (!item.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 180
  tooltip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
/* ── Compact variant ── */
.bs-compact {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  max-width: 100%;
  min-width: 0;
}

.bs-compact-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-color: var(--border-strong) transparent;
  scrollbar-width: thin;
}

.bs-compact-icons::-webkit-scrollbar {
  height: 3px;
}

.bs-compact-icons::-webkit-scrollbar-track {
  background: transparent;
}

.bs-compact-icons::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--border-strong);
}

.bs-compact-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: default;
  border-radius: 6px;
  flex: 0 0 auto;
  transition: background 0.12s;
}

@media (hover: hover) { .bs-compact-chip:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); } }

.bs-compact-svg-img {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bs-compact-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
}

.bs-compact-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px dashed var(--border-strong);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  flex: 0 0 auto;
}

@media (hover: hover) {
  .bs-compact-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-2);
    background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  }
}

.bs-plus {
  position: relative;
  width: 10px;
  height: 10px;
  display: block;
  flex-shrink: 0;
}

.bs-plus-h,
.bs-plus-v {
  position: absolute;
  background: currentColor;
  border-radius: 1px;
}

.bs-plus-h { width: 10px; height: 2px; top: 4px; left: 0; }
.bs-plus-v { width: 2px; height: 10px; top: 0; left: 4px; }

.bs-compact-btn-label {
  line-height: 1;
}

/* ── Block wrapper ── */
.bs-block {
  position: relative;
}

.bs-block-only-add {
  display: inline-flex;
}

.bs-only-add {
  display: inline-flex;
  align-items: center;
}

.bs-summary-tile {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}

.bs-only-add :deep(.sa-trigger-text) {
  min-height: 28px;
  border-color: color-mix(in srgb, var(--text-muted) 58%, transparent);
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
}

@media (hover: hover) {
  .bs-only-add :deep(.sa-trigger-text:hover) {
    border-color: color-mix(in srgb, var(--text-2) 72%, transparent);
    color: var(--text-on-accent);
  }
}

/* ── Default: status tiles ── */
.bs-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
}

.bs-chips-one-line {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.bs-chips-one-line::-webkit-scrollbar {
  display: none;
}

.bs-tile {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 42px;
  padding: 0 12px 0 14px;
  cursor: default;
}

.bs-tile-svg {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bs-tile-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1;
  white-space: nowrap;
}

.bs-add-tile {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  border-radius: var(--r-lg);
  border: 1px dashed var(--border-strong);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

@media (hover: hover) {
  .bs-add-tile:hover { border-color: var(--accent); color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
}

/* ── Empty ── */
.bs-empty {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
