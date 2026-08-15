<template>
  <div class="scene-reward-editor">
    <div v-if="items.length" class="scene-reward-editor-list">
      <div v-for="(entry, index) in items" :key="`${entry.itemId}:${index}`" class="scene-reward-editor-row">
        <ItemIcon :item="itemById(entry.itemId)" :size="30" placeholder />
        <strong>{{ itemById(entry.itemId)?.name || entry.name || `Предмет #${entry.itemId}` }}</strong>
        <FormNumberInput :value="entry.count || 1" :min="1" :max="999" @change="setCount(index, $event)" />
        <button type="button" aria-label="Удалить награду" @click="remove(index)"><Trash2 :size="16" /></button>
      </div>
    </div>
    <div v-else class="scene-reward-editor-empty">
      Добавьте вещи, оружие или снаряжение, которые можно получить в этой сцене.
    </div>

    <button type="button" class="scene-reward-editor-add" @click="pickerOpen = true">
      <Gift :size="17" />Добавить награду
    </button>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[2, 1, 10]"
      :z-index="3200"
      title="Награда"
      search-placeholder="Поиск вещей, оружия и снаряжения..."
      allow-quantity
      @close="pickerOpen = false"
      @pick="addItem"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Gift, Trash2 } from '@lucide/vue'
import { FormNumberInput } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useItemReferenceMap } from '@/features/sessions/composables/useItemReferenceMap'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const pickerOpen = ref(false)
const items = computed(() => props.modelValue)
const itemIds = computed(() => props.modelValue.map(entry => entry.itemId))
const { itemById } = useItemReferenceMap(itemIds)

function normalizedCount(value) {
  return Math.max(1, Math.min(999, Math.floor(Number(value) || 1)))
}

function addItem(item, count) {
  const next = props.modelValue.map(entry => ({ ...entry }))
  const existing = next.find(entry => String(entry.itemId) === String(item.id))
  if (existing) existing.count = normalizedCount((existing.count || 1) + normalizedCount(count))
  else next.push({ itemId: item.id, name: item.name || 'Предмет', count: normalizedCount(count) })
  emit('update:modelValue', next)
}

function setCount(index, count) {
  emit('update:modelValue', props.modelValue.map((entry, entryIndex) => entryIndex === index
    ? { ...entry, count: normalizedCount(count) }
    : entry))
}

function remove(index) {
  emit('update:modelValue', props.modelValue.filter((_, entryIndex) => entryIndex !== index))
}
</script>

<style scoped>
.scene-reward-editor { display: flex; flex-direction: column; gap: 12px; }
.scene-reward-editor-list { display: flex; flex-direction: column; gap: 7px; }
.scene-reward-editor-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto 34px;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}
.scene-reward-editor-row strong { overflow: hidden; color: var(--text-1); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.scene-reward-editor-row button { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: none; color: var(--text-muted); cursor: pointer; }
.scene-reward-editor-row button:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.scene-reward-editor-empty { padding: 16px; border: 1px dashed var(--border-strong); border-radius: 9px; color: var(--text-muted); font-size: 12px; text-align: center; }
.scene-reward-editor-add { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.scene-reward-editor-add:hover { border-color: var(--warning); color: var(--warning); }
@media (max-width: 560px) {
  .scene-reward-editor-row { grid-template-columns: 34px minmax(0, 1fr) auto; }
  .scene-reward-editor-row :deep(.fn-wrap) { grid-column: 2; }
  .scene-reward-editor-row button { grid-column: 3; grid-row: 1 / span 2; }
}
</style>
