<template>
  <div class="handbook-reference-rows">
    <LoadingState v-if="loading" label="Загружаем связанные записи…" compact />
    <p v-else-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="load">Повторить</ActionButton></p>
    <template v-else>
      <div v-for="(row, index) in rows" :key="row.key || `${row.id}:${index}`" class="handbook-reference" :class="{ 'handbook-reference--split': split }">
        <aside v-if="split"><slot name="info" :row="row" :item="items[row.id]" /></aside>
        <div class="handbook-reference-content">
        <BaseTile class="handbook-reference-tile" v-if="items[row.id]" interactive framed role="button" tabindex="0" :aria-label="items[row.id].name"
          @click.stop="view = items[row.id]" @keydown.enter.stop.prevent="view = items[row.id]" @keydown.space.stop.prevent="view = items[row.id]">
          <HandbookListItem :item="items[row.id]" :type="types.getType(items[row.id].typeId)" />
        </BaseTile>
        <span v-else>Запись #{{ row.id }} недоступна</span>
        <small v-if="row.condition">{{ row.condition }}</small>
        <slot name="description" :row="row" :item="items[row.id]" />
        </div>
      </div>
    </template>
    <ItemViewModal v-if="view" :item="view" :item-id="view.id" :item-type-id="view.typeId" :z-index="zIndex" @close="view = null" />
  </div>
</template>
<script setup>
import { onScopeDispose, ref, watch } from 'vue'
import { ActionButton, BaseTile, LoadingState } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import { collectSuggestIds } from '@/features/handbook/objects/lib/schemaFields'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ split: Boolean, rows: { type: Array, default: () => [] }, zIndex: { type: Number, default: 5100 } })
const types = useItemTypesStore(), suggests = useSuggestStore()
const items = ref({}), loading = ref(false), error = ref(''), view = ref(null)
let sequence = 0
async function load() {
  const request = ++sequence, ids = [...new Set(props.rows.map(row => Number(row.id)).filter(id => id > 0))]
  error.value = ''; loading.value = !!ids.length
  if (!ids.length) { items.value = {}; return }
  try {
    const response = await itemsApi.byIds(ids)
    const schemas = await Promise.all([...new Set((response.items || []).map(item => item.typeId))].map(id => types.ensureType(id)))
    await Promise.all([...new Set(schemas.flatMap(type => [...collectSuggestIds(type?.fields || [])]))].map(id => suggests.ensure(id)))
    if (request === sequence) items.value = Object.fromEntries((response.items || []).map(item => [item.id, item]))
  } catch { if (request === sequence) error.value = 'Не удалось загрузить связанные записи.' }
  finally { if (request === sequence) loading.value = false }
}
watch(() => props.rows.map(row => row.id).join(','), load, { immediate: true })
onScopeDispose(() => { sequence++ })
</script>
<style scoped>
.handbook-reference-rows { display: grid; gap: 8px; min-width: 0; }
.handbook-reference { display: grid; gap: 4px; min-width: 0; }
.handbook-reference--split { grid-template-columns: minmax(130px, .85fr) minmax(0, 1.25fr); gap: 12px; align-items: start; }
.handbook-reference-content { display: grid; gap: 8px; min-width: 0; }
.handbook-reference aside { min-width: 0; }
.handbook-reference-tile { padding: 8px 10px; }
.handbook-reference small { color: var(--text-muted); font-size: 11px; line-height: 1.4; }
@media (max-width: 520px) { .handbook-reference--split { grid-template-columns: minmax(0, 1fr); } }
</style>
