<template>
  <div class="magic-bases">
    <LoadingState v-if="loading" label="Загружаем подходящие основы…" compact />
    <div v-else-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="load">Повторить</ActionButton></div>
    <p v-else-if="!bases.length">Подходящих основ нет. Уточните варианты у автора предмета.</p>
    <div v-else class="magic-bases-grid" :class="{ 'magic-bases-grid--single': singleColumn }" :role="selectable ? 'radiogroup' : undefined" :aria-label="label">
      <BaseTile v-for="base in bases" :key="base.id" interactive class="magic-base-tile"
        :tint="selectable && Number(modelValue) === Number(base.id)"
        :framed="singleColumn || selectable && Number(modelValue) === Number(base.id)"
        :role="selectable ? 'radio' : 'button'" :tabindex="0" :aria-label="base.name"
        :aria-checked="selectable ? Number(modelValue) === Number(base.id) : undefined"
        @click="activate(base)" @keydown.enter.prevent="activate(base)" @keydown.space.prevent="activate(base)">
        <HandbookListItem :item="base" :type="itemTypes.getType(base.typeId) || { id: base.typeId }" />
      </BaseTile>
    </div>
    <ItemViewModal v-if="view" :item="view" :item-id="view.id" :item-type-id="view.typeId" :z-index="zIndex + 100" @close="view = null" />
  </div>
</template>
<script setup>
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import { collectSuggestIds } from '@/features/handbook/objects/lib/schemaFields'
import { onServerPrefetch, ref, watch } from 'vue'
import { ActionButton, BaseTile, LoadingState } from '@sylvieshare/share-ui'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { baseTypeId } from '@/features/items/lib/magicEquipmentBases'
import { loadMagicBases } from '@/features/items/lib/loadMagicBases'
const props = defineProps({ item: Object, kind: String, baseItems: { type: Array, default: () => [] }, singleColumn: Boolean, selectable: Boolean, modelValue: [Number, String], label: { type: String, default: 'Подходящие основы' }, zIndex: { type: Number, default: 4800 } })
const itemTypes = useItemTypesStore(), suggest = useSuggestStore()
const emit = defineEmits(['update:modelValue', 'loaded'])
const bases = ref([]), loading = ref(false), error = ref(''), view = ref(null)
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true; error.value = ''; bases.value = []; emit('loaded', [])
  try {
    const rows = await loadMagicBases(props.item, props.kind, props.baseItems)
    if (request !== sequence) return
    bases.value = rows
    emit('loaded', bases.value)
    const type = itemTypes.getType(baseTypeId(props.kind))
    const suggestIds = [...collectSuggestIds(type?.fields || [])]
    if (suggestIds.length) await Promise.all(suggestIds.map(id => suggest.ensure(id)))
  } catch { if (request === sequence) error.value = 'Не удалось загрузить основы.' }
  finally { if (request === sequence) loading.value = false }
}
function activate(base) { if (props.selectable) emit('update:modelValue', base.id); else view.value = base }
let pending
watch(() => [props.item.id, props.kind, JSON.stringify(props.item.data?.[props.kind]), props.baseItems], () => { pending = load() }, { immediate: true })
onServerPrefetch(() => pending)
</script>
<style scoped>
.magic-bases-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.magic-bases-grid--single { grid-template-columns: minmax(0, 1fr); }
.magic-base-tile { padding: 8px 10px; min-width: 0; }
.magic-base-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 540px) { .magic-bases-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
