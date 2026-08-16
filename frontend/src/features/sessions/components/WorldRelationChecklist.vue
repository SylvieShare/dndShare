<template>
  <div class="world-relation-checklist">
    <div class="world-relation-search-wrap">
      <Search :size="14" />
      <input v-model="query" type="search" :placeholder="placeholder" />
      <span v-if="modelValue.length">{{ modelValue.length }}</span>
    </div>
    <div v-if="visibleItems.length" class="world-relation-items">
      <label v-for="item in visibleItems" :key="item.id" class="world-relation-item">
        <input
          type="checkbox"
          :checked="selected.has(item.id)"
          @change="toggle(item.id, $event.target.checked)"
        />
        <span
          v-if="item.image"
          class="world-relation-image"
          :style="{ backgroundImage: `url(${item.image})` }"
        />
        <span
          v-else
          class="world-relation-mark"
          :style="{ '--relation-color': item.color || 'var(--accent)' }"
        >{{ item.mark || '•' }}</span>
        <span class="world-relation-copy">
          <strong>{{ item.title }}</strong>
          <small v-if="item.subtitle">{{ item.subtitle }}</small>
        </span>
      </label>
    </div>
    <div v-else class="world-relation-empty">{{ items.length ? 'Ничего не найдено' : emptyText }}</div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Search } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Найти…' },
  emptyText: { type: String, default: 'Пока нечего выбирать' },
})
const emit = defineEmits(['update:model-value'])
const query = ref('')
const selected = computed(() => new Set(props.modelValue))
const visibleItems = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  if (!needle) return props.items
  return props.items.filter(item => `${item.title} ${item.subtitle || ''}`.toLocaleLowerCase('ru').includes(needle))
})

function toggle(id, checked) {
  const next = new Set(props.modelValue)
  if (checked) next.add(id)
  else next.delete(id)
  emit('update:model-value', [...next])
}
</script>

<style scoped>
.world-relation-checklist { min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.world-relation-search-wrap { display: flex; min-height: 34px; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-muted); }
.world-relation-search-wrap input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--text-1); font: inherit; font-size: 12px; }
.world-relation-search-wrap > span { min-width: 20px; padding: 2px 5px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-soft); font-size: 9px; font-weight: 800; text-align: center; }
.world-relation-items { max-height: 230px; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; }
.world-relation-item { display: flex; min-width: 0; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.world-relation-item:hover { background: var(--surface-raised); }
.world-relation-item input { flex: none; accent-color: var(--accent); }
.world-relation-image, .world-relation-mark { width: 30px; height: 30px; flex: none; border-radius: 7px; }
.world-relation-image { background-position: center; background-size: cover; }
.world-relation-mark { display: grid; place-items: center; background: color-mix(in srgb, var(--relation-color) 18%, var(--surface-raised)); color: var(--relation-color); font-family: var(--font-display); font-size: 13px; font-weight: 800; }
.world-relation-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 2px; }
.world-relation-copy strong, .world-relation-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.world-relation-copy strong { color: var(--text-1); font-size: 12px; font-weight: 650; }
.world-relation-copy small { color: var(--text-muted); font-size: 10px; }
.world-relation-empty { padding: 18px 8px; color: var(--text-muted); font-size: 11px; text-align: center; }
</style>
