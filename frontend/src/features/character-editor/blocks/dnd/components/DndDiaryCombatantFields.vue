<template>
  <div class="diary-combatant-source"><MultiToggle v-model="source" :options="sourceOptions" aria-label="Источник участника" /></div>
  <FormField v-if="value.source === 'handbook'" label="Существо" vertical>
    <button class="diary-creature-picker" type="button" @click="picker = true">
      <ItemIcon :item="itemsById.get(String(value.itemId))" :size="32" placeholder />
      <span class="diary-creature-copy">{{ value.itemName || itemsById.get(String(value.itemId))?.name || 'Выбрать из бестиария' }}</span><Search :size="16" />
    </button>
  </FormField>
  <FormField v-else label="Имя участника" vertical><FormTextInput :value="value.name" aria-label="Имя участника" placeholder="Имя участника" @update:value="update({ name: $event })" /></FormField>
  <div class="diary-combatant-fields">
    <label>Количество<FormNumberInput :value="value.count" :min="1" :max="999" @change="update({ count: $event })" /></label>
    <template v-if="value.source === 'custom'">
      <label>Класс брони<FormNumberInput :value="value.ac" :min="0" :max="99" @change="update({ ac: $event })" /></label>
      <label>HP<FormNumberInput :value="value.hp" :min="0" :max="9999" @change="update({ hp: $event })" /></label>
    </template>
  </div>
  <FormField label="Заметка" vertical><FormTextarea :value="value.desc" aria-label="Заметка об участнике" placeholder="Особенности или итог встречи" :rows="2" :maxlength="2000" @update:value="update({ desc: $event })" /></FormField>
  <ItemPickerModal v-if="picker" :z-index="3800" :item-type-ids="[6]" title="Бестиарий" search-placeholder="Поиск существ…" @close="picker = false" @pick="pick" />
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormField, FormNumberInput, FormTextInput, FormTextarea, MultiToggle } from '@sylvieshare/share-ui'
import { Search } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
const props = defineProps({ value: { type: Object, required: true }, itemsById: { type: Map, default: () => new Map() } })
const emit = defineEmits(['update:value'])
const picker = ref(false)
const sourceOptions = [{ value: 'custom', label: 'Своё существо' }, { value: 'handbook', label: 'Из бестиария' }]
const source = computed({ get: () => props.value.source, set: source => update(source === 'custom' ? { source, itemId: null, itemName: '' } : { source }) })
function update(patch) { emit('update:value', { ...props.value, ...patch }) }
function pick(item) { update({ source: 'handbook', itemId: item.id, itemName: item.name || '' }); picker.value = false }
</script>
<style scoped>
.diary-combatant-source { min-width: 0; display: flex; flex-wrap: wrap; }
.diary-creature-picker { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; border: 1px dashed var(--border-strong); border-radius: var(--r-sm); background: transparent; color: var(--text-2); font: 600 13px var(--font-ui); text-align: left; cursor: pointer; }
.diary-creature-picker:hover { border-color: var(--accent); }
.diary-creature-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.diary-creature-picker > svg { flex: none; color: var(--text-muted); }
.diary-combatant-fields { display: flex; flex-wrap: wrap; gap: 14px 20px; }
.diary-combatant-fields label { display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 11px; }
</style>
