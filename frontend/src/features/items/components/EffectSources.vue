<template>
  <DetailSection v-if="rows.length || loading || error" label="Источники применения">
    <HandbookReferenceRows v-if="rows.length" :rows="rows" :z-index="zIndex" />
    <LoadingState v-if="loading" label="Загрузка источников…" compact />
    <p v-else-if="error" role="alert">{{ error }} <AddButton label="Повторить" @click="load(true)" /></p>
    <AddButton v-else-if="hasMore" label="Показать ещё" @click="load(true)" />
  </DetailSection>
</template>
<script setup>
import { onScopeDispose, ref, watch } from 'vue'
import { AddButton, LoadingState } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import DetailSection from '@/shared/ui/DetailSection.vue'
import HandbookReferenceRows from './HandbookReferenceRows.vue'
const props = defineProps({ itemId: Number, zIndex: { type: Number, default: 5100 } })
const rows = ref([]), loading = ref(false), error = ref(''), hasMore = ref(false)
let sequence = 0
async function load(more = false) {
  const request = ++sequence, offset = more ? rows.value.length : 0
  if (!more) rows.value = []
  error.value = ''; loading.value = !!props.itemId
  if (!props.itemId) return
  try {
    const result = await itemsApi.effectSources(props.itemId, offset)
    if (request !== sequence) return
    const page = result.sources || []
    rows.value = [...rows.value, ...page.map(row => ({ id: row.itemId, key: `${row.itemId}:${row.key}`,
      condition: [row.target === 'other' ? 'На цель' : 'На владельца', row.condition].filter(Boolean).join(' · ') }))]
    hasMore.value = page.length === 40
  } catch { if (request === sequence) error.value = 'Не удалось загрузить источники эффекта.' }
  finally { if (request === sequence) loading.value = false }
}
watch(() => props.itemId, () => load(), { immediate: true })
onScopeDispose(() => { sequence++ })
</script>
