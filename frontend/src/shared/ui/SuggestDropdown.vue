<template>
  <BasePopover :open="true" :anchor="anchor" :min-width="220" :z-index="3000" related @update:open="!$event && $emit('close')">
    <LoadingState v-if="loading" label="Загружаем варианты…" compact />
    <div v-else-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="reload">Повторить</ActionButton></div>
    <OptionList v-else :id="listId" :options="options" :active-index="activeIndex" empty-label="Ничего не найдено" label="Варианты" @active="activeIndex = $event" @select="pickItem($event.item)" @hover="showTooltip($event.event, $event.option.item)" @leave="hideTooltip">
      <template #option="{ option: { item } }">
        <img v-if="iconUrl(item)" class="sd-icon" :src="iconUrl(item)" alt="" aria-hidden="true" />
        <span v-else-if="item.color" class="sd-dot" :style="{ background: item.color }" />
        <span class="sd-item-value">{{ item.value }}</span>
        <button v-if="item.userId != null" class="sd-delete-btn" type="button" aria-label="Удалить вариант" @mousedown.prevent.stop @click.stop="deleteItem(item)">×</button>
        <span v-if="item.userId != null" class="sd-custom-mark" title="Ваш вариант">✦</span>
      </template>
      <template v-if="canAdd" #footer><ActionButton variant="quiet" @mousedown.prevent.stop @click="addNew">+ Добавить «{{ query.trim() }}»</ActionButton></template>
    </OptionList>
    <ItemTooltip v-if="tooltip.visible" :anchor="tooltip.anchor" :title="tooltip.title" :desc="tooltip.desc" :x="tooltip.x" :top="tooltip.top" :bottom="tooltip.bottom" />
  </BasePopover>
</template>

<script setup>
import { BasePopover, OptionList, ActionButton, LoadingState } from '@sylvieshare/share-ui'
import { useSuggestLoading } from '@/shared/composables/useSuggestLoading'
import { ref, computed, watch, useId, nextTick } from 'vue'
import { fetchPost, fetchDelete } from "@/shared/api/http"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"

const props = defineProps({
  anchor: { type: Object, default: null },
  canAddNew: { type: Boolean, default: true },
  items: { type: Array, default: () => [] },
  query: { type: String, default: '' },
  typeId: { type: [Number, String], required: true },
  exclude: { type: Array, default: () => [] },
})
const { loading, error, reload } = useSuggestLoading(() => props.typeId)
const emit = defineEmits(['pick', 'pick-item', 'added', 'deleted', 'close'])

const listId = useId()
const activeIndex = ref(0)
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const available = computed(() => {
  if (!props.exclude.length) return props.items
  const excluded = new Set(props.exclude.map(String))
  return props.items.filter(it => !excluded.has(String(it.value)))
})
const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (!q) return available.value
  return available.value.filter(it => it.value.toLowerCase().includes(q))
})
const canAdd = computed(() => {
  if (!props.canAddNew || props.typeId === '__local__') return false
  const q = props.query.trim()
  if (!q) return false
  return !props.items.some(it => String(it.value).toLowerCase() === q.toLowerCase())
      && !props.exclude.some(v => String(v).toLowerCase() === q.toLowerCase())
})

const options = computed(() => filtered.value.map(item => ({ value: item.id, label: item.value, item })))
watch(filtered, rows => { activeIndex.value = rows.length ? 0 : -1 })
function handleKeydown(event) {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    const count = filtered.value.length
    activeIndex.value = count ? (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : -1
    nextTick(() => document.getElementById(`${listId}-${activeIndex.value}`)?.scrollIntoView({ block: 'nearest' }))
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (filtered.value[activeIndex.value]) pickItem(filtered.value[activeIndex.value])
    else if (canAdd.value) addNew()
  } else if (event.key === 'Escape' || event.key === 'Tab') emit('close')
}
const activeDescendant = computed(() => activeIndex.value >= 0 ? `${listId}-${activeIndex.value}` : undefined)
defineExpose({ handleKeydown, listId, activeDescendant })

function iconUrl(item) {
  return item.iconUrl || item.icon_url || item.svg || item.icon || ''
}

function pickItem(item) {
  emit('pick', item.value)
  emit('pick-item', item)
}

function addNew() {
  const val = props.query.trim()
  fetchPost('/suggest/' + props.typeId, { value: val })
    .then(res => {
      emit('added', res)
      emit('pick', val)
      emit('pick-item', res)
    })
}

function deleteItem(item) {
  fetchDelete('/suggest/' + props.typeId + '/' + item.id)
    .then(() => emit('deleted', item.id))
}

function showTooltip(event, item) {
  if (!item.desc) return
  tooltip.value = {
    visible: true,
    anchor: event.currentTarget,
    title: item.value,
    desc: item.desc,
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
.sd-icon { width: 20px; height: 20px; display: block; flex: none; object-fit: contain; }
.sd-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.sd-item-value { flex: 1; min-width: 0; }
.sd-custom-mark { color: var(--accent-soft); font-size: 9px; flex: none; }
.sd-delete-btn { border: 0; border-radius: 4px; background: none; color: var(--text-muted); cursor: pointer; }
.sd-delete-btn:hover { color: var(--danger); }
</style>
