<template>
  <div class="dmsm">
    <div v-if="hasActiveSummary" class="dmsm-active" aria-label="Активные статусы">
      <div class="dmsm-active-inner">
        <span
          v-for="item in activeItems"
          :key="item.id"
          class="dmsm-status"
          :style="{ '--status-color': item.color || 'var(--text-muted)' }"
          :aria-label="item.value"
          @mouseenter="showStatusTooltip($event, item)"
          @mouseleave="hideStatusTooltip"
        >
          <SvgIcon v-if="item.svg" class="dmsm-status-icon" :svg="item.svg" :color="item.color || '#888888'" filter />
          <span v-else class="dmsm-status-dot"></span>
        </span>
        <button
          v-if="exhaustionLevel > 0"
          class="dmsm-badge dmsm-badge--exhaustion"
          type="button"
          :disabled="!canInteract"
          :title="`Истощение: ${exhaustionLevel}`"
          @click="openEditor('exhaustion')"
        >
          Истощение {{ exhaustionLevel }}
        </button>
        <span v-if="inspirationActive" class="dmsm-badge dmsm-badge--inspiration" title="Вдохновение">
          <span aria-hidden="true">✦</span> Вдохновение
        </span>
      </div>
    </div>

    <RowActionMenu v-if="canInteract" title="Статусы">
      <template #trigger="{ open }">
        <button class="dmsm-trigger" :class="{ 'dmsm-trigger--open': open }" type="button" :aria-expanded="open">
          Статусы
          <span class="dmsm-chevron" aria-hidden="true"></span>
        </button>
      </template>
      <template #default="{ close }">
        <RowActionItem :icon="Activity" @click="openEditor('states', close)">
          Статусы
          <template v-if="activeIds.length" #suffix><span class="dmsm-menu-value">{{ activeIds.length }}</span></template>
        </RowActionItem>
        <RowActionItem :icon="BatteryLow" @click="openEditor('exhaustion', close)">
          Истощение
          <template v-if="exhaustionLevel > 0" #suffix><span class="dmsm-menu-value dmsm-menu-value--danger">{{ exhaustionLevel }}</span></template>
        </RowActionItem>
        <RowActionItem :icon="Sparkles" @click="openEditor('inspiration', close)">
          Вдохновение
          <template v-if="inspirationActive" #suffix><span class="dmsm-menu-value dmsm-menu-value--accent">✦</span></template>
        </RowActionItem>
      </template>
    </RowActionMenu>

    <AppModalFrame v-if="editorKind === 'states'" title="Статусы" :padded="false" @close="closeEditor">
      <BlockStatesPickerEditor
        :suggest-type-id="suggestTypeId"
        :items="allItems"
        :active-ids="activeIds"
        title="Активные статусы"
        @toggle="toggleState"
        @created="onStateCreated"
      />
    </AppModalFrame>

    <AppModalFrame v-if="editorKind === 'exhaustion'" title="Истощение" :padded="false" @close="closeEditor">
      <DndExhaustionEditor :value="exhaustionValue" embedded @change="setExhaustion" />
    </AppModalFrame>

    <AppModalFrame v-if="editorKind === 'inspiration'" title="Вдохновение" :padded="false" @close="closeEditor">
      <DndInspirationEditor :value="inspirationValue" embedded @change="setInspiration" />
    </AppModalFrame>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { Activity, BatteryLow, Sparkles } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import BlockStatesPickerEditor from '@/features/character-editor/blocks/generic/components/BlockStatesPickerEditor'
import DndExhaustionEditor from '@/features/character-editor/blocks/dnd/components/DndExhaustionEditor'
import DndInspirationEditor from '@/features/character-editor/blocks/dnd/components/DndInspirationEditor'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import SvgIcon from '@/shared/ui/SvgIcon'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'
import { isInspirationActive } from '@/features/character-editor/blocks/dnd/lib/mobileStatus'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  block: { type: Object, required: true },
  values: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const suggestStore = useSuggestStore()
const editorKind = ref(null)
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const ids = computed(() => ({
  states: props.block.content?.states_id || 'states',
  exhaustion: props.block.content?.exhaustion_id || 'exhaustion',
  inspiration: props.block.content?.inspiration_id || 'inspiration',
}))
const suggestTypeId = computed(() => props.block.content?.states_suggest_id || 9)
const activeIds = computed(() => Array.isArray(props.values?.[ids.value.states]) ? props.values[ids.value.states] : [])
const allItems = computed(() => suggestStore.items(suggestTypeId.value))
const activeItems = computed(() => allItems.value.filter(item => activeIds.value.includes(item.id)))
const exhaustionValue = computed(() => props.values?.[ids.value.exhaustion] || { level: 0 })
const exhaustionLevel = computed(() => normalizeExhaustion(exhaustionValue.value).level)
const inspirationValue = computed(() => props.values?.[ids.value.inspiration] ?? false)
const inspirationActive = computed(() => isInspirationActive(inspirationValue.value))
const hasActiveSummary = computed(() => activeItems.value.length > 0 || exhaustionLevel.value > 0 || inspirationActive.value)
const canInteract = computed(() => !!charCtx.ownerMode)

onMounted(() => {
  suggestStore.ensure(suggestTypeId.value)
})

function updateValue(id, value) {
  emit('update:value', id, value)
}
function showStatusTooltip(event, item) {
  if (!item.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 180
  tooltip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: rect.left + rect.width / 2 - 180,
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  }
}
function hideStatusTooltip() {
  tooltip.value.visible = false
}
function openEditor(kind, closeMenu) {
  hideStatusTooltip()
  closeMenu?.()
  editorKind.value = kind
}
function closeEditor() {
  editorKind.value = null
}
function toggleState(id) {
  const next = activeIds.value.includes(id)
    ? activeIds.value.filter(value => value !== id)
    : [...activeIds.value, id]
  updateValue(ids.value.states, next)
}
function onStateCreated(item) {
  suggestStore.addItem(suggestTypeId.value, item)
}
function setExhaustion(value) {
  updateValue(ids.value.exhaustion, value)
}
function setInspiration(value) {
  updateValue(ids.value.inspiration, value)
}
</script>

<style scoped>
.dmsm {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  min-height: 40px;
}
.dmsm-active {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.dmsm-active::-webkit-scrollbar { display: none; }
.dmsm-active-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  min-width: min-content;
  margin-left: auto;
}
.dmsm-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
}
.dmsm-status-icon { width: 28px; height: 28px; display: inline-flex; }
.dmsm-status-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--status-color); }
.dmsm-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  height: 24px;
  box-sizing: border-box;
  padding: 0 7px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
  font-family: inherit;
  white-space: nowrap;
}
.dmsm-badge--exhaustion { border: 0; color: var(--danger); background: color-mix(in srgb, var(--danger) 11%, transparent); cursor: pointer; touch-action: manipulation; }
.dmsm-badge--exhaustion:disabled { cursor: default; }
.dmsm-badge--inspiration { color: var(--accent-soft); background: color-mix(in srgb, var(--accent) 13%, transparent); }
.dmsm-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
}
.dmsm :deep(.ram-custom-trigger) { flex: 0 0 auto; }
.dmsm-trigger--open { border-color: var(--accent); color: var(--text-1); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.dmsm-chevron {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.14s ease;
}
.dmsm-trigger--open .dmsm-chevron { transform: translateY(2px) rotate(225deg); }
.dmsm-menu-value { color: var(--text-muted); font-size: 11px; }
.dmsm-menu-value--danger { color: var(--danger); }
.dmsm-menu-value--accent { color: var(--accent-soft); }
</style>
