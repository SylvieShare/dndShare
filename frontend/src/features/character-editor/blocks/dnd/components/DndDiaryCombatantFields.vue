<template>
  <MultiToggle v-model="source" :options="sourceOptions" aria-label="Источник участника" />
  <button v-if="value.source === 'handbook'" class="diary-inline-add" type="button" @click="picker = true">{{ value.itemName || 'Выбрать из бестиария' }}</button>
  <FormTextInput v-else :value="value.name" aria-label="Имя участника" placeholder="Имя участника" @update:value="update({ name: $event })" />
  <div class="diary-combatant-fields">
    <label>Количество<FormNumberInput :value="value.count" :min="1" :max="999" @change="update({ count: $event })" /></label>
    <template v-if="value.source === 'custom'">
      <label>Класс брони<FormNumberInput :value="value.ac" :min="0" :max="99" @change="update({ ac: $event })" /></label>
      <label>HP<FormNumberInput :value="value.hp" :min="0" :max="9999" @change="update({ hp: $event })" /></label>
    </template>
  </div>
  <FormTextarea :value="value.desc" aria-label="Заметка об участнике" placeholder="Заметка об участнике" :rows="2" :maxlength="2000" @update:value="update({ desc: $event })" />
  <ItemPickerModal v-if="picker" :z-index="3800" :item-type-ids="[6]" title="Бестиарий" search-placeholder="Поиск существ…" @close="picker = false" @pick="pick" />
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormNumberInput, FormTextInput, FormTextarea, MultiToggle } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
const props = defineProps({ value: { type: Object, required: true } })
const emit = defineEmits(['update:value'])
const picker = ref(false)
const sourceOptions = [{ value: 'custom', label: 'Своё существо' }, { value: 'handbook', label: 'Из бестиария' }]
const source = computed({ get: () => props.value.source, set: source => update(source === 'custom' ? { source, itemId: null, itemName: '' } : { source }) })
function update(patch) { emit('update:value', { ...props.value, ...patch }) }
function pick(item) { update({ source: 'handbook', itemId: item.id, itemName: item.name || '' }); picker.value = false }
</script>
<style scoped>
.diary-combatant-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.diary-combatant-fields label { display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 11px; }
</style>
