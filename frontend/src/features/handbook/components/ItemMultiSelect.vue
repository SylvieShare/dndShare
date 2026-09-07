<template>
  <div class="item-multi" :aria-label="label">
    <div v-if="selectedItems.length" class="item-multi__rows">
      <BaseTile v-for="item in selectedItems" :key="item.id" class="item-multi__selected">
        <button type="button" class="item-multi__row-button" :aria-label="`Открыть: ${item.name}`" @click="previewId = item.id">
          <HandbookListItem :item="item" :type="itemType" />
        </button>
        <RemoveButton :label="`Убрать: ${item.name}`" variant="inline" @click="remove(item.id)" />
      </BaseTile>
    </div>
    <div v-if="hydrationError" class="item-multi__status" role="status">
      {{ hydrationError }} <AddButton label="Повторить" variant="inline" @click="hydrate" />
    </div>
    <AddButton :label="selectedItems.length ? 'Изменить выбор' : 'Выбрать записи'" variant="inline" @click="begin" />

    <AppModalFrame v-if="open" wide :title="label" :z-index="zIndex" @close="close">
      <div class="item-multi__picker">
        <FormTextInput v-model:value="search" placeholder="Поиск по названию — RU / EN…" aria-label="Поиск записей" />
        <div class="item-multi__rows" :aria-busy="loading">
          <BaseTile v-for="item in items" :key="item.id" interactive :tint="draft.includes(item.id)">
            <button type="button" class="item-multi__row-button" :aria-pressed="draft.includes(item.id)" @click="toggle(item.id)">
              <Check v-if="draft.includes(item.id)" :size="20" class="item-multi__check" aria-hidden="true" />
              <Square v-else :size="20" class="item-multi__check-space" aria-hidden="true" />
              <HandbookListItem :item="item" :type="itemType" :show-chevron="false" />
            </button>
          </BaseTile>
          <p v-if="loading" class="item-multi__status" role="status">Загрузка…</p>
          <div v-else-if="error" class="item-multi__status" role="alert">
            {{ error }} <AddButton label="Повторить" variant="inline" @click="retry" />
          </div>
          <p v-else-if="!items.length" class="item-multi__status">{{ search ? 'Ничего не найдено' : 'В справочнике пока нет записей' }}</p>
          <AddButton v-else-if="hasMore" label="Показать ещё" variant="inline" @click="loadMore" />
        </div>
      </div>
      <template #footer>
        <div class="item-multi__footer">
          <span class="item-multi__status" role="status">Выбрано: {{ draft.length }}</span>
          <FormActionButtons submit-text="Готово" @submit="apply" @cancel="close" />
        </div>
      </template>
    </AppModalFrame>
    <ItemViewModal v-if="previewId" :item-id="previewId" :item-type-id="itemTypeId" :z-index="zIndex + 100" @close="previewId = null" @saved="updateItem" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Check, Square } from '@lucide/vue'
import { AddButton, AppModalFrame, BaseTile, FormActionButtons, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from './ItemViewModal.vue'
import { useItemMultiSelect } from '../composables/useItemMultiSelect'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  itemTypeId: { type: Number, required: true },
  label: { type: String, default: 'Выбор записей' },
  zIndex: { type: Number, default: 4700 },
})
const emit = defineEmits(['update:modelValue'])
const types = useItemTypesStore()
const itemType = computed(() => types.getType(props.itemTypeId) || { id: props.itemTypeId })
watch(() => props.itemTypeId, id => types.ensureType(id).catch(() => null), { immediate: true })
const previewId = ref(null)
const {
  open, search, draft, items, selectedItems, loading, error, hydrationError, hasMore,
  begin, close, apply, hydrate, updateItem, toggle, remove, loadMore, retry,
} = useItemMultiSelect(props, emit)
</script>

<style scoped>
.item-multi, .item-multi__rows, .item-multi__picker { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.item-multi__picker { gap: 16px; }
.item-multi__selected { display: flex; align-items: center; gap: 4px; padding-right: 10px; min-width: 0; }
.item-multi__row-button { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; padding: 8px; border: 0; border-radius: inherit; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.item-multi__row-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.item-multi__check, .item-multi__check-space { flex: 0 0 20px; width: 20px; color: var(--accent); }
.item-multi__status { margin: 0; color: var(--text-muted); font-size: 12px; }
.item-multi__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
</style>
