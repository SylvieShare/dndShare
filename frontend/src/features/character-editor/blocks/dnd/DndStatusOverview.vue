<template>
  <div ref="root" class="dso-root" :class="`dso-root--${displayMode}`">
    <DndStatusOverviewView
      v-if="summaryItems.length || showAddAction"
      :items="summaryItems"
      :editable="canInteract"
      :show-add-action="showAddAction"
      @add="pickerOpen = true"
      @view="viewStatus"
      @remove="removeDisplayItem"
      @increase-level="changeDisplayItemLevel($event, 1)"
      @decrease-level="changeDisplayItemLevel($event, -1)"
      @show-tooltip="showStatusTooltip"
      @hide-tooltip="hideStatusTooltip"
    />
  </div>

  <ItemPickerModal
    v-if="pickerOpen"
    :item-type-ids="[effectItemTypeId]"
    title="Эффекты и состояния"
    search-placeholder="Поиск эффекта..."
    :z-index="3400"
    @close="pickerOpen = false"
    @pick="addStatus"
  />

  <ItemViewModal
    v-if="viewItem"
    :item="viewItem"
    :item-id="Number(viewItem.id)"
    :item-type-id="effectItemTypeId"
    @close="viewItem = null"
  />

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
import { computed, inject, ref } from 'vue'
import DndStatusOverviewView from '@/features/character-editor/blocks/dnd/components/DndStatusOverviewView'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'
import { isInspirationActive } from '@/features/character-editor/blocks/dnd/lib/mobileStatus'

const props = defineProps({
  block: { type: Object, required: true },
  values: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const root = ref(null)
const pickerOpen = ref(false)
const viewItem = ref(null)
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const ids = computed(() => ({
  states: props.block.content?.states_id || 'states',
  exhaustion: props.block.content?.exhaustion_id || 'exhaustion',
  inspiration: props.block.content?.inspiration_id || 'inspiration',
}))
const effectItemTypeId = computed(() => Number(props.block.content?.effect_item_type_id) || 15)
const statuses = computed(() => {
  const value = charCtx.characterStatuses?.entries
  return Array.isArray(value) ? value : Array.isArray(value?.value) ? value.value : []
})
const activeItems = computed(() => statuses.value.map(status => ({
  id: status.uid,
  kind: 'states',
  value: status.title,
  desc: status.description,
  thesis: status.item?.data?.thesis || status.description,
  color: status.color,
  item: status.item,
  level: Math.max(0, Number(status.params?.level ?? status.item?.data?.level) || 0),
  adjustableLevel: Number(status.item?.data?.level) > 0,
  maxLevel: Math.max(0, Number(status.item?.data?.max_level) || 0),
  polarity: status.polarity,
})))
const exhaustionValue = computed(() => props.values?.[ids.value.exhaustion] || { level: 0 })
const normalizedExhaustion = computed(() => normalizeExhaustion(exhaustionValue.value))
const exhaustionLevel = computed(() => normalizedExhaustion.value.level)
const exhaustionEffects = computed(() => normalizedExhaustion.value.effects.slice(0, exhaustionLevel.value))
const inspirationValue = computed(() => props.values?.[ids.value.inspiration] ?? false)
const inspirationActive = computed(() => isInspirationActive(inspirationValue.value))
const exhaustionItem = computed(() => charCtx.characterStatuses?.itemByCode?.('exhaustion') || null)
const inspirationItem = computed(() => charCtx.characterStatuses?.itemByCode?.('inspiration') || null)
const displayItems = computed(() => [
  ...activeItems.value,
  ...(exhaustionLevel.value > 0 ? [{
    id: 'exhaustion',
    kind: 'exhaustion',
    value: exhaustionItem.value?.name || 'Истощение',
    desc: exhaustionEffects.value.join(' · '),
    thesis: exhaustionItem.value?.data?.thesis || 'Штрафы растут с уровнем.',
    color: exhaustionItem.value?.data?.color || 'var(--danger)',
    level: exhaustionLevel.value,
    adjustableLevel: true,
    maxLevel: 6,
    item: exhaustionItem.value,
  }] : []),
  ...(inspirationActive.value ? [{
    id: 'inspiration',
    kind: 'inspiration',
    value: inspirationItem.value?.name || 'Вдохновение',
    desc: inspirationItem.value?.data?.desc || '',
    thesis: inspirationItem.value?.data?.thesis || 'Преимущество на один бросок.',
    color: inspirationItem.value?.data?.color || 'var(--accent)',
    item: inspirationItem.value,
  }] : []),
])
const canInteract = computed(() => !!charCtx.ownerMode)
const displayMode = computed(() => props.block.content?.display || 'all')
const summaryItems = computed(() => (displayMode.value === 'trigger' ? [] : displayItems.value))
const showAddAction = computed(() => canInteract.value && displayMode.value !== 'summary')

function updateValue(id, value) {
  emit('update:value', id, value)
}

function addStatus(item) {
  pickerOpen.value = false
  charCtx.characterResources?.rememberItems?.([item])
  if (item?.data?.code === 'exhaustion') {
    setExhaustion({ ...normalizedExhaustion.value, level: Math.max(1, exhaustionLevel.value) })
    return
  }
  if (item?.data?.code === 'inspiration') {
    setInspiration(true)
    return
  }
  updateValue(ids.value.states, charCtx.characterStatuses?.addManual?.(item) || [])
}

function removeStatus(uid) {
  updateValue(ids.value.states, charCtx.characterStatuses?.remove?.(uid) || [])
}

function setExhaustion(value) {
  updateValue(ids.value.exhaustion, value)
}

function setInspiration(value) {
  updateValue(ids.value.inspiration, value)
}

function viewStatus(item) {
  viewItem.value = item?.item || null
}

function removeDisplayItem(item) {
  if (item.kind === 'exhaustion') setExhaustion({ ...normalizedExhaustion.value, level: 0 })
  else if (item.kind === 'inspiration') setInspiration(false)
  else removeStatus(item.id)
}

function changeDisplayItemLevel(item, delta) {
  if (item.kind === 'exhaustion') {
    const level = Math.max(1, Math.min(6, exhaustionLevel.value + delta))
    setExhaustion({ ...normalizedExhaustion.value, level })
    return
  }
  const maxLevel = item.maxLevel || 99
  const level = Math.max(1, Math.min(maxLevel, (Number(item.level) || 1) + delta))
  updateValue(ids.value.states, charCtx.characterStatuses?.setLevel?.(item.id, level) || [])
}

function showStatusTooltip(event, item) {
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

function hideStatusTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
.dso-root { min-width: 0; }
.dso-root--trigger :deep(.dsov) { gap: 0; padding: 7px 0 14px 21px; }
.dso-root--trigger :deep(.dsov-add) { width: 76px; height: 32px; gap: 3px; padding: 0 4px; font-size: 9px; }
</style>
