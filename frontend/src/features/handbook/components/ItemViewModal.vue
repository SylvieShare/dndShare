<template>
  <AppModalFrame
    wide
    :padded="false"
    :title="item?.name || (loading ? 'Загрузка…' : 'Предмет')"
    :subtitle="formattedNameEn"
    @close="$emit('close')"
  >
    <div v-if="loading" class="iv-loading">Загрузка…</div>
    <HandbookItemDetail v-else :item="item" :type="type" :can-edit="false" :show-title="false" />

    <template v-if="item && $slots.actions" #footer>
      <slot name="actions" :item="item" :type="type" />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'

const itemCache = new Map()
const inflightItems = new Map()

async function loadItem(id) {
  if (itemCache.has(id)) return itemCache.get(id)
  if (inflightItems.has(id)) return inflightItems.get(id)
  const p = itemsApi.byIds([id]).then(res => {
    const found = res?.items?.[0] ?? null
    if (found) itemCache.set(id, found)
    inflightItems.delete(id)
    return found
  }).catch(() => { inflightItems.delete(id); return null })
  inflightItems.set(id, p)
  return p
}

const props = defineProps({
  itemTypeId: { type: Number, required: true },
  itemId: { type: Number, default: null },
  item: { type: Object, default: null },
})

defineEmits(['close'])

const item = ref(props.item)
const type = ref(null)
const loading = ref(false)

const itemTypesStore = useItemTypesStore()
const formattedNameEn = computed(() => String(item.value?.nameEn || '')
  .replace(/_/g, ' ')
  .replace(/\b[a-z]/g, char => char.toUpperCase()))

async function load() {
  loading.value = true
  try {
    const [typeRes, itemRes] = await Promise.all([
      itemTypesStore.ensureType(props.itemTypeId).catch(() => null),
      props.item ? Promise.resolve(props.item) : (props.itemId != null ? loadItem(props.itemId) : Promise.resolve(null)),
    ])
    type.value = typeRes ?? { id: props.itemTypeId, name: '', fields: [] }
    item.value = itemRes
  } finally {
    loading.value = false
  }
}

watch(() => [props.itemId, props.itemTypeId, props.item], load, { immediate: true })
</script>

<style scoped>
.iv-loading {
  padding: 60px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
}
</style>
