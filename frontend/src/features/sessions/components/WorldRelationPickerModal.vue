<template>
  <AppModalFrame :title="title" @close="$emit('close')">
    <label class="relation-picker-search">
      <Search :size="15" />
      <input v-model="query" type="search" :placeholder="placeholder" autofocus />
    </label>
    <div v-if="filteredItems.length" class="relation-picker-list">
      <button v-for="item in filteredItems" :key="item.id" type="button" @click="$emit('select', item.id)">
        <img v-if="item.image" :src="item.image" alt="" />
        <span v-else class="relation-picker-avatar" :style="{ '--relation-color': item.color || '#7c5cff' }">
          {{ item.initial || item.title?.slice(0, 1) }}
        </span>
        <span><strong>{{ item.title }}</strong><small v-if="item.subtitle">{{ item.subtitle }}</small></span>
        <Plus :size="16" />
      </button>
    </div>
    <div v-else class="relation-picker-empty">{{ query ? 'Ничего не найдено' : emptyText }}</div>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, Search } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'

const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  excludedIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Найти…' },
  emptyText: { type: String, default: 'Нет доступных вариантов' },
})
defineEmits(['close', 'select'])
const query = ref('')
const filteredItems = computed(() => {
  const excluded = new Set(props.excludedIds.map(Number))
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return props.items.filter(item => !excluded.has(Number(item.id))
    && (!needle || `${item.title} ${item.subtitle || ''}`.toLocaleLowerCase('ru').includes(needle)))
})
</script>

<style scoped>
.relation-picker-search { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-muted); }
.relation-picker-search:focus-within { border-color: var(--accent); }
.relation-picker-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--text-1); font: inherit; }
.relation-picker-list { max-height: min(55vh, 520px); display: flex; flex-direction: column; gap: 6px; overflow-y: auto; margin-top: 12px; }
.relation-picker-list button { width: 100%; min-height: 54px; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 6px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; text-align: left; }
.relation-picker-list button:hover { border-color: var(--accent); color: var(--accent-soft); }
.relation-picker-list img, .relation-picker-avatar { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }
.relation-picker-avatar { background: color-mix(in srgb, var(--relation-color) 18%, var(--surface)); color: var(--relation-color); font-weight: 800; }
.relation-picker-list button > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.relation-picker-list strong, .relation-picker-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.relation-picker-list strong { color: var(--text-1); font-size: 13px; }.relation-picker-list small { color: var(--text-muted); font-size: 10px; }
.relation-picker-empty { padding: 34px 12px; color: var(--text-muted); font-size: 12px; text-align: center; }
</style>
