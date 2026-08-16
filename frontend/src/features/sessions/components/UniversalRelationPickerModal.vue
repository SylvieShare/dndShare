<template>
  <AppModalFrame title="Добавить связь" @close="$emit('close')">
    <div class="entity-picker-types">
      <button v-for="type in filters" :key="type.key" type="button" :class="{ active: activeType === type.key }" @click="activeType = type.key">{{ type.label }}</button>
    </div>
    <label class="entity-picker-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Искать по всем объектам…" autofocus /></label>
    <div v-if="groups.length" class="entity-picker-results">
      <section v-for="group in groups" :key="group.key">
        <h3>{{ group.label }}<span>{{ group.items.length }}</span></h3>
        <button v-for="item in group.items" :key="item.key" type="button" @click="$emit('select', item)">
          <img v-if="item.image" :src="item.image" alt="" />
          <span v-else class="entity-picker-avatar" :style="{ '--entity-color': item.color || group.color }">{{ item.title.slice(0, 1) }}</span>
          <span><strong>{{ item.title }}</strong><small v-if="item.subtitle">{{ item.subtitle }}</small></span><Plus :size="16" />
        </button>
      </section>
    </div>
    <div v-else class="entity-picker-empty">{{ query ? 'Ничего не найдено' : 'Нет доступных объектов' }}</div>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, Search } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { SESSION_ENTITY_TYPES, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'

const props = defineProps({ items: { type: Array, default: () => [] }, excluded: { type: Array, default: () => [] } })
defineEmits(['close', 'select'])
const query = ref('')
const activeType = ref('all')
const filters = [{ key: 'all', label: 'Все' }, ...SESSION_ENTITY_TYPES]
const groups = computed(() => {
  const excluded = new Set(props.excluded.map(item => sessionEntityKey(item.type, item.id)))
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return SESSION_ENTITY_TYPES
    .filter(type => activeType.value === 'all' || activeType.value === type.key)
    .map(type => ({ ...type, items: props.items.filter(item => item.type === type.key && !excluded.has(item.key)
      && (!needle || `${item.title} ${item.subtitle || ''}`.toLocaleLowerCase('ru').includes(needle))) }))
    .filter(group => group.items.length)
})
</script>

<style scoped>
.entity-picker-types { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }.entity-picker-types button { padding: 6px 9px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: 10px; }.entity-picker-types button.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent-soft); }
.entity-picker-search { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid var(--border); border-radius: 9px; color: var(--text-muted); }.entity-picker-search:focus-within { border-color: var(--accent); }.entity-picker-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--text-1); font: inherit; }
.entity-picker-results { max-height: min(56vh, 540px); overflow-y: auto; margin-top: 12px; }.entity-picker-results section { display: flex; flex-direction: column; gap: 5px; margin-bottom: 13px; }.entity-picker-results h3 { display: flex; justify-content: space-between; margin: 0 5px 2px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }.entity-picker-results h3 span { font-variant-numeric: tabular-nums; }.entity-picker-results section > button { min-height: 54px; display: grid; grid-template-columns: 40px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 6px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; text-align: left; }.entity-picker-results section > button:hover { border-color: var(--accent); }.entity-picker-results img,.entity-picker-avatar { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }.entity-picker-avatar { background: color-mix(in srgb, var(--entity-color) 18%, var(--surface)); color: var(--entity-color); font-weight: 800; }.entity-picker-results section > button > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.entity-picker-results strong,.entity-picker-results small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.entity-picker-results strong { color: var(--text-1); font-size: 13px; }.entity-picker-results small { color: var(--text-muted); font-size: 10px; }.entity-picker-empty { padding: 34px 12px; color: var(--text-muted); text-align: center; font-size: 12px; }
</style>
