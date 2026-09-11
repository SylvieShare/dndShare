<template>
  <div class="weapon-roll-controls" role="group" :aria-label="scope === 'attack' ? 'Атака' : 'Урон'">
    <WeaponRollOption v-for="use in scope === 'attack' ? uses : []" :key="use.key" :option="useOption(use)" @select="(key, value) => $emit('update:useKey', value ? key : '')" />
    <template v-if="scope === 'damage'">
      <FormField label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
        <ToggleSwitch :model-value="critical" aria-label="Критическое попадание" @update:model-value="$emit('update:critical', $event)" />
      </FormField>
      <FormField v-if="versatile" label="Двумя руками" title="Использует кость урона для хвата двумя руками.">
        <ToggleSwitch :model-value="twoHanded" :disabled="thrown" aria-label="Двумя руками" @update:model-value="!thrown && $emit('update:twoHanded', $event)" />
      </FormField>
    </template>
    <WeaponRollOption v-for="option in (scope === 'attack' && useKey ? [] : modes)" :key="option.key" :option="option" @select="(key, value) => $emit('select', key, value)" @amount="(key, value) => $emit('amount', key, value)" />
    <RowActionSeparator v-if="scope === 'damage' && extras.length" />
    <WeaponRollOption v-for="option in (scope === 'attack' && useKey ? [] : extras)" :key="option.key" :option="option" @select="(key, value) => $emit('select', key, value)" @amount="(key, value) => $emit('amount', key, value)" />
    <DamageFormulaPreview v-if="scope === 'damage'" :expression="preview" />
    <small v-if="blocked" role="alert">{{ blocked.resourceError }}</small>
    <RowActionItem :disabled="!!blocked" :action="scope === 'attack' ? 'attack' : 'damage'" @click="!blocked && $emit('roll')">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
  </div>
</template>
<script setup>
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import { computed } from 'vue'
const props = defineProps({ uses: { type: Array, default: () => [] }, useKey: { type: String, default: '' }, scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, critical: Boolean, twoHanded: Boolean, versatile: Boolean, thrown: Boolean, preview: { type: String, default: '' } })
function useOption(use) {
  const checked = props.useKey === use.key
  const condition = use.attack_mode === 'melee' ? 'Рукопашная атака' : `Дистанция до ${use.range_ft} футов`
  return { key: use.key, label: use.title, checked, disabled: !checked && (use.disabled || !!props.useKey),
    damageParts: [], condition, hint: [condition, use.error, use.resource_cost && `Расход при атаке: ${use.resource_cost}, даже при промахе.`].filter(Boolean).join(' · '),
    resourceCost: use.resource_cost ? { amount: use.resource_cost, color: use.resource?.color_point, unavailable: use.disabled } : null }
}
const modes = computed(() => props.options.filter(option => option.mode))
const extras = computed(() => props.options.filter(option => !option.mode))
const chosenUse = computed(() => props.uses.find(use => use.key === props.useKey))
const blocked = computed(() => props.scope === 'attack' && props.useKey ? (chosenUse.value && !chosenUse.value.error ? null : { resourceError: chosenUse.value?.error || 'Режим недоступен.' }) : props.scope === 'damage' && props.options.find(option => option.checked && option.resourceError))
defineEmits(['update:useKey', 'update:critical', 'update:twoHanded', 'select', 'amount', 'roll'])
</script>
<style scoped>
.weapon-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
</style>
