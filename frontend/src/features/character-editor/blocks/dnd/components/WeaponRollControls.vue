<template>
  <div class="weapon-roll-controls" role="group" :aria-label="scope === 'attack' ? 'Атака' : 'Урон'">
    <template v-if="scope === 'attack' && uses.length">
      <FormField label="Режим атаки" title="Особый режим списывает ресурс при броске атаки, даже при промахе." vertical>
        <FormSelect :value="useKey" aria-label="Режим атаки" @update:value="$emit('update:useKey', $event)"><option value="">Обычная атака</option><option v-for="use in uses" :key="use.key" :value="use.key" :disabled="use.disabled">{{ use.title }}{{ use.disabled ? ' · недоступно' : '' }}</option></FormSelect>
      </FormField>
      <small v-if="chosenUse">{{ chosenUse.attack_mode === 'melee' ? 'Рукопашная атака' : `Дистанция до ${chosenUse.range_ft} футов` }}<span v-if="chosenUse.resource_cost" class="weapon-use-cost" :aria-label="`Расход при атаке: ${chosenUse.resource_cost}`"> · −{{ chosenUse.resource_cost > 1 ? chosenUse.resource_cost : '' }}<SpellSlotSphere :size="22" :color="chosenUse.resource?.color_point" :interactive="false" /></span></small>
      <small v-for="use in uses.filter(row => row.disabled)" :key="use.key">{{ use.title }}: {{ use.error }}</small>
    </template>
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
import { FormField, FormSelect, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
import WeaponRollOption from './WeaponRollOption.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import { computed } from 'vue'
const props = defineProps({ uses: { type: Array, default: () => [] }, useKey: { type: String, default: '' }, scope: { type: String, default: 'damage' }, options: { type: Array, default: () => [] }, critical: Boolean, twoHanded: Boolean, versatile: Boolean, thrown: Boolean, preview: { type: String, default: '' } })
const modes = computed(() => props.options.filter(option => option.mode))
const extras = computed(() => props.options.filter(option => !option.mode))
const chosenUse = computed(() => props.uses.find(use => use.key === props.useKey))
const blocked = computed(() => props.scope === 'attack' && props.useKey ? (chosenUse.value && !chosenUse.value.error ? null : { resourceError: chosenUse.value?.error || 'Режим недоступен.' }) : props.scope === 'damage' && props.options.find(option => option.checked && option.resourceError))
defineEmits(['update:useKey', 'update:critical', 'update:twoHanded', 'select', 'amount', 'roll'])
</script>
<style scoped>
.weapon-use-cost { display: inline-flex; align-items: center; gap: 3px; vertical-align: middle; }
.weapon-roll-controls { display: flex; flex-direction: column; gap: 10px; padding: 8px; min-width: 240px; }
</style>
