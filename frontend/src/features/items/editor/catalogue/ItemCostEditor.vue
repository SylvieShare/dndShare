<template>
  <FormField :label="field.name" vertical :title="field.hint">
    <div class="item-cost-fields">
      <div class="item-cost-amounts">
        <FormTextInput type="number" step="any" min="0" :aria-label="`${field.name}: сумма`" :value="modelValue?.value ?? ''" :placeholder="field.allow_range ? 'Точная цена' : 'Сумма'" @update:value="value => update('value', value)" />
        <FormSelect :aria-label="`${field.name}: валюта`" :value="modelValue?.suggest_id ?? ''" @update:value="value => update('suggest_id', value)">
          <option value="">Валюта</option><option v-for="coin in coins" :key="coin.id" :value="coin.id">{{ coin.value }}</option>
        </FormSelect>
      </div>
      <FormField v-if="field.allow_range" label="Диапазон цен" title="Можно задать вместе с точной ценой или отдельно. Валюта общая для цены и диапазона.">
        <ToggleSwitch :model-value="range" aria-label="Диапазон цен" @update:model-value="toggleRange" />
      </FormField>
      <div v-if="range" class="item-cost-amounts">
        <FormTextInput type="number" step="any" min="0" :aria-label="`${field.name}: от`" :value="modelValue?.min ?? ''" placeholder="От" @update:value="value => update('min', value)" />
        <FormTextInput type="number" step="any" min="0" :aria-label="`${field.name}: до`" :value="modelValue?.max ?? ''" placeholder="До" @update:value="value => update('max', value)" />
      </div>
    </div>
  </FormField>
</template>
<script setup>
import { computed } from 'vue'
import { FormField, FormSelect, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { numberOrNull } from '@/features/handbook/objects/lib/schemaFields'
import { isCostRange } from '@/features/items/lib/itemCost'
const props = defineProps({ field: Object, modelValue: Object, coins: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const range = computed(() => isCostRange(props.modelValue))
function update(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: numberOrNull(value) }) }
function toggleRange(on) {
  const next = { ...props.modelValue }
  if (on) { next.min = null; next.max = null }
  else { delete next.min; delete next.max }
  emit('update:modelValue', next)
}
</script>
<style scoped>
.item-cost-fields { display: grid; gap: 8px; }
.item-cost-amounts { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; }
</style>
