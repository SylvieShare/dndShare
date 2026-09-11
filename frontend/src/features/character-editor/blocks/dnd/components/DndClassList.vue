<template>
  <div class="identity-class-list">
    <ObjectListItem v-for="entry in entries" :key="entry.id" :item="items[entry.id] || entry"
      :subtitle="entry.subclass?.name || 'Без подкласса'" :show-chevron="false" :icon-fallback-to-type="false">
      <template #icon-fallback><span class="identity-class-initial">{{ entry.name.slice(0, 1) }}</span></template>
      <template #metric><span class="identity-class-level">{{ entry.level }}<small>уровень</small></span></template>
    </ObjectListItem>
    <span v-if="!entries.length" class="identity-classes-empty">Классы не указаны</span>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem.vue'
import { itemsApi } from '@/shared/api/itemsApi'

const props = defineProps({ entries: { type: Array, required: true } })
const items = ref({})
watch(() => props.entries.map(entry => entry.id).join(','), async (ids, _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  if (!ids) return
  try {
    const result = await itemsApi.byIds(ids.split(','))
    if (active) items.value = Object.fromEntries((result.items || []).map(item => [item.id, item]))
  } catch {
    // Stored references keep the list readable if handbook artwork is unavailable.
  }
}, { immediate: true })
</script>

<style scoped>
.identity-class-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.identity-class-initial { color: var(--text-muted); font: 700 28px var(--font-display); }
.identity-class-level { display: flex; flex-direction: column; gap: 4px; }
.identity-class-level small { color: var(--text-muted); font-size: 9px; font-weight: 500; }
.identity-classes-empty { color: var(--text-muted); font-size: 13px; }
</style>
