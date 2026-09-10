<template>
  <span v-if="!itemId">Не привязан</span>
  <button v-else type="button" class="session-bestiary-reference" :aria-label="`Открыть в справочнике: ${item?.name || fallbackName}`" @click="opened = true">
    <HandbookListItem v-if="item" :item="item" :type="type" />
    <LoadingIndicator v-else-if="loading" label="Загрузка существа…" size="xs" inline show-label />
    <span v-else>{{ fallbackName }}</span>
  </button>
  <ItemViewModal v-if="opened && itemId" :item-id="Number(itemId)" :item-type-id="6" :item="item" :z-index="9300" @close="opened = false" @saved="item = $event" />
</template>
<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { ref, watch } from 'vue'
import { useItemTypesStore } from '@/stores/itemTypes'
import { itemsApi } from '@/shared/api/itemsApi'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ itemId: { type: [Number, String], default: null }, fallbackName: { type: String, default: '' } })
const itemTypes = useItemTypesStore()
const type = ref(null)
const item = ref(null), opened = ref(false), loading = ref(false)
watch(() => props.itemId, async (id, _, onCleanup) => {
  let active = true; onCleanup(() => { active = false })
  item.value = null; opened.value = false
  if (!id) { loading.value = false; return }
  loading.value = true
  try {
    const [result, schema] = await Promise.all([itemsApi.byIds([Number(id)]), itemTypes.ensureType(6)])
    if (active) { item.value = result?.items?.[0] || null; type.value = schema }
  }
  catch { /* Keep the reference accessible; the handbook dialog can retry loading it. */ }
  finally { if (active) loading.value = false }
}, { immediate: true })
</script>
<style scoped>
.session-bestiary-reference { display: block; width: 100%; padding: 0; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.session-bestiary-reference:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
