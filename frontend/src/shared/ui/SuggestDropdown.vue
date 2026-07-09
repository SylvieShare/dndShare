<template>
  <div class="sd-dropdown">
    <template v-if="filtered.length > 0">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="sd-item"
        :style="item.color ? { '--c': item.color } : {}"
        @mouseenter="showTooltip($event, item)"
        @mouseleave="hideTooltip"
        @mousedown.prevent="pickItem(item)"
      >
        <img v-if="iconUrl(item)" class="sd-icon" :src="iconUrl(item)" alt="" aria-hidden="true" />
        <span v-else-if="item.color" class="sd-dot"></span>
        <span class="sd-item-value">{{ item.value }}</span>
        <button
          v-if="item.userId != null"
          class="sd-delete-btn"
          @mousedown.prevent.stop="deleteItem(item)"
        >×</button>
        <span v-if="item.userId != null" class="sd-custom-mark" title="Ваш вариант">✦</span>
      </div>
    </template>
    <div v-if="canAdd" class="sd-add" @mousedown.prevent="addNew">
      + Добавить «{{ query.trim() }}»
    </div>
    <div v-if="filtered.length === 0 && !canAdd" class="sd-empty">
      Ничего не найдено
    </div>
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
import { ref, computed } from 'vue'
import { fetchPost, fetchDelete } from "@/shared/api/http"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"

const props = defineProps({
  items: { type: Array, default: () => [] },
  query: { type: String, default: '' },
  typeId: { type: [Number, String], required: true },
  exclude: { type: Array, default: () => [] },
})
const emit = defineEmits(['pick', 'pick-item', 'added', 'deleted'])

const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const available = computed(() => {
  if (!props.exclude.length) return props.items
  const excluded = props.exclude.map(String)
  return props.items.filter(it => !excluded.includes(String(it.value)))
})
const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (!q) return available.value
  return available.value.filter(it => it.value.toLowerCase().includes(q))
})
const canAdd = computed(() => {
  const q = props.query.trim()
  if (!q) return false
  return !props.items.some(it => String(it.value).toLowerCase() === q.toLowerCase())
      && !props.exclude.some(v => String(v).toLowerCase() === q.toLowerCase())
})

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
.sd-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  background-color: #2e2d30;
  border-radius: 10px;
  padding: 6px 0;
  z-index: 50;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.sd-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px 7px 14px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 4px;
}

.sd-item:hover {
  background-color: var(--border);
}

.sd-item-value {
  flex: 1;
  color: var(--text-2);
  font-size: 15px;
}

.sd-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  flex-shrink: 0;
}

.sd-icon {
  width: 20px;
  height: 20px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}

.sd-item:hover .sd-item-value {
  color: #fff;
}

.sd-custom-mark {
  color: #7a6aaa;
  font-size: 9px;
  flex-shrink: 0;
  line-height: 1;
}

.sd-delete-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s ease, background-color 0.15s ease;
  opacity: 0;
}

.sd-item:hover .sd-delete-btn {
  opacity: 1;
}

.sd-delete-btn:hover {
  color: var(--danger);
  background-color: rgba(224, 85, 85, 0.12);
}

.sd-add {
  padding: 8px 14px;
  color: #7a7aff;
  font-size: 15px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 4px;
}

.sd-add:hover {
  background-color: rgba(122, 122, 255, 0.12);
}

.sd-empty {
  padding: 8px 14px;
  color: var(--text-muted);
  font-size: 15px;
}
</style>
