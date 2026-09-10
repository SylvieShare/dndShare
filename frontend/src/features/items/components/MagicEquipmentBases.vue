<template>
  <div class="magic-bases">
    <LoadingState v-if="loading" label="Загружаем подходящие основы…" compact />
    <div v-else-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="load">Повторить</ActionButton></div>
    <p v-else-if="!bases.length">Подходящих основ нет. Уточните варианты у автора предмета.</p>
    <div v-else class="magic-bases-grid" :role="selectable ? 'radiogroup' : undefined" :aria-label="label">
      <HandbookListItem v-for="base in bases" :key="base.id" :item="base" :type="{ id: base.typeId }"
        :role="selectable ? 'radio' : 'button'" :tabindex="0" :aria-checked="selectable ? Number(modelValue) === Number(base.id) : undefined"
        :class="{ 'magic-base-selected': selectable && Number(modelValue) === Number(base.id) }"
        @click="activate(base)" @keydown.enter.prevent="activate(base)" @keydown.space.prevent="activate(base)" />
    </div>
    <ItemViewModal v-if="view" :item="view" :item-id="view.id" :item-type-id="view.typeId" :z-index="zIndex + 100" @close="view = null" />
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { ActionButton, LoadingState } from '@sylvieshare/share-ui'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { baseTypeId, eligibleMagicBase } from '@/features/items/lib/magicEquipmentBases'
const props = defineProps({ item: Object, kind: String, selectable: Boolean, modelValue: [Number, String], label: { type: String, default: 'Подходящие основы' }, zIndex: { type: Number, default: 4800 } })
const emit = defineEmits(['update:modelValue', 'loaded'])
const bases = ref([]), loading = ref(false), error = ref(''), view = ref(null)
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true; error.value = ''; bases.value = []; emit('loaded', [])
  const rule = props.item.data?.[props.kind] || {}
  const ids = rule.base_item_id ? [rule.base_item_id] : rule.allowed_base_item_ids
  try {
    const response = ids?.length ? await itemsApi.byIds(ids) : await itemsApi.listAll(baseTypeId(props.kind))
    if (request !== sequence) return
    bases.value = (response.items || []).filter(base => eligibleMagicBase(props.item, base, props.kind)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    emit('loaded', bases.value)
  } catch { if (request === sequence) error.value = 'Не удалось загрузить основы.' }
  finally { if (request === sequence) loading.value = false }
}
function activate(base) { if (props.selectable) emit('update:modelValue', base.id); else view.value = base }
watch(() => [props.item.id, props.kind, JSON.stringify(props.item.data?.[props.kind])], load, { immediate: true })
</script>
<style scoped>
.magic-bases-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.magic-base-selected { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 540px) { .magic-bases-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
